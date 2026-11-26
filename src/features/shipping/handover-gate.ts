/**
 * Shipping — vì sao nút "Xác nhận bàn giao" đang khoá (R7: lý do nói ngay dưới nút, không chỉ ở `title`). Cùng các điều kiện
 * mà `allowedLoadActions` gate (docs 09 BR-18: bàn giao là tất cả hoặc không): chuyến có lô, không còn kiện phải dỡ, đã
 * quét đủ kiện, mọi đơn trên xe được phép đi (BE tính lại `handoverWarnings` ở mỗi lần đọc chuyến đang xếp). Hàm thuần.
 */

import { SHIPPING_LIMITS } from "@/constants";

import { hasPendingUnloads, hasWaybill } from "./ftl-selectors";

import type { HandoverWarning, Load } from "./types";

export type HandoverBlocker =
  | { kind: "empty" }
  | { kind: "unloadPending" }
  /** Chưa có mã vận đơn (BR-23): BE từ chối 409 LOAD_WAYBILL_MISSING. */
  | { kind: "waybill" }
  /** Còn `count` kiện chưa quét; `codes` là vài mã đầu để quét nốt, `more` là số kiện còn lại không liệt kê. */
  | { kind: "unscanned"; count: number; codes: readonly string[]; more: number }
  | { kind: "order"; order: HandoverWarning };

type GateLoad = Pick<
  Load,
  | "shipmentCount"
  | "expectedPackageCount"
  | "loadedPackageCount"
  | "shipments"
  | "handoverWarnings"
  | "waybillNo"
> &
  Partial<Pick<Load, "pendingUnloads">>;

export function handoverBlockers(load: GateLoad): HandoverBlocker[] {
  const blockers: HandoverBlocker[] = [];
  if (load.shipmentCount === 0) blockers.push({ kind: "empty" });
  if (hasPendingUnloads(load)) blockers.push({ kind: "unloadPending" });
  const missing = load.expectedPackageCount - load.loadedPackageCount;
  if (load.shipmentCount > 0 && missing > 0) {
    const codes = load.shipments
      .flatMap((shipment) => shipment.packages)
      .filter((parcel) => !parcel.loaded)
      .map((parcel) => parcel.labelCode);
    const shown = codes.slice(0, SHIPPING_LIMITS.unscannedListed);
    blockers.push({
      kind: "unscanned",
      count: missing,
      codes: shown,
      more: missing - shown.length,
    });
  }
  if (!hasWaybill(load)) blockers.push({ kind: "waybill" });
  for (const order of load.handoverWarnings ?? []) blockers.push({ kind: "order", order });
  return blockers;
}
