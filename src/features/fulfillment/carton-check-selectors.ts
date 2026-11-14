/**
 * Trạm kiểm thùng — selectors thuần, derive từ phiên kiểm thùng BE trả về (không side effect).
 */

import { CARTON_STATUS } from "@/constants";

import type { Carton, CartonCheckLine, CartonCheckSession } from "./carton-check-types";

const byNumber = (a: Carton, b: Carton) => a.packageNo - b.packageNo;

/** Thùng theo số thứ tự. */
export function sortedCartons(session: Pick<CartonCheckSession, "cartons">): Carton[] {
  return [...session.cartons].sort(byNumber);
}

/** Thùng đã bị loại (hư hỏng, hoặc đơn huỷ) — nằm trong hàng chờ cất lại. */
export function removedCartons(session: Pick<CartonCheckSession, "cartons">): Carton[] {
  return sortedCartons(session).filter((carton) => carton.status === CARTON_STATUS.REMOVED);
}

const sameLpn = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Thùng của phiên có LPN này (BE nhận mọi kiểu chữ hoa / thường). */
export function findCarton(
  session: Pick<CartonCheckSession, "cartons">,
  lpn: string,
): Carton | undefined {
  return session.cartons.find((carton) => sameLpn(carton.lpn, lpn));
}

/** Thùng còn đang tính vào đơn: chưa bị loại. */
export const isLiveCarton = (carton: Pick<Carton, "status">): boolean =>
  carton.status !== CARTON_STATUS.REMOVED && carton.status !== "Unknown";

/** Đã quét kiểm (kể cả đã dán nhãn) — quét lại không ghi thêm (docs 08 BR-05). */
export const isChecked = (carton: Pick<Carton, "status">): boolean =>
  carton.status === CARTON_STATUS.CHECKED || carton.status === CARTON_STATUS.LABELED;

export interface CartonProgress {
  total: number;
  /** Đã quét (kể cả đã dán nhãn) — cùng cách đếm với `checkedCount` của hàng chờ. */
  checked: number;
  labeled: number;
  removed: number;
}

export function cartonProgress(session: Pick<CartonCheckSession, "cartons">): CartonProgress {
  const live = session.cartons.filter(isLiveCarton);
  return {
    total: live.length,
    checked: live.filter(isChecked).length,
    labeled: live.filter((carton) => carton.status === CARTON_STATUS.LABELED).length,
    removed: session.cartons.filter((carton) => carton.status === CARTON_STATUS.REMOVED).length,
  };
}

/** Dòng đã đủ số cái đã dán nhãn so với số cần của đợt giao. */
export const isLineComplete = (
  line: Pick<CartonCheckLine, "wantedUnits" | "labeledUnits">,
): boolean => line.labeledUnits >= line.wantedUnits;

export interface CompletionReadiness {
  /** Thùng còn To Check / Checked: BE chặn (`PACKING_INCOMPLETE`) tới khi dán nhãn hoặc loại. */
  pending: Carton[];
  /** Thùng đã dán nhãn chưa vào shipment — sẽ thành shipment mới. */
  toShip: Carton[];
  /** Dòng chưa đủ số cái đã dán nhãn: chỉ giao được một phần (có ghi chú, đơn phải cho phép). */
  missing: CartonCheckLine[];
  canFull: boolean;
  canPartial: boolean;
}

/**
 * Điều kiện hoàn tất (BE `CartonCheck.complete`, docs 08 §4.4 bước 8): mọi thùng Labeled hoặc Removed; có ít nhất một
 * thùng Labeled chưa vào shipment; thiếu so với dòng đơn của đợt giao thì chỉ giao một phần kèm ghi chú. BE vẫn là nơi
 * quyết (409 `PACKING_INCOMPLETE` / `PACK_NOTHING_TO_SHIP` / `PACK_PARTIAL_NOT_ALLOWED`).
 */
export function completionReadiness(session: CartonCheckSession): CompletionReadiness {
  const cartons = sortedCartons(session);
  const pending = cartons.filter(
    (carton) => carton.status === CARTON_STATUS.TO_CHECK || carton.status === CARTON_STATUS.CHECKED,
  );
  const toShip = cartons.filter(
    (carton) => carton.status === CARTON_STATUS.LABELED && !carton.shipmentId,
  );
  const missing = session.lines.filter((line) => line.wantedUnits > 0 && !isLineComplete(line));
  const ready = pending.length === 0 && toShip.length > 0;
  return {
    pending,
    toShip,
    missing,
    canFull: ready && missing.length === 0,
    canPartial: ready && missing.length > 0,
  };
}
