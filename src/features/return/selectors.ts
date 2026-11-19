/**
 * Selector thuần của trả hàng — trần số lượng theo BE `ReturnLine` (`claimedUnits`, `refundableUnits`) và tiến độ quét
 * của phiếu nhập hàng hoàn. Không side effect.
 */

import { RETURN_LABELS } from "@/constants/labels-return";
import { RETURN_LIMITS } from "@/constants/returns";

import type { ReturnApiStatus } from "@/constants/returns";
import type { ExpectedCarton, ReturnLine, ReturnReceipt, ReturnRequest } from "./types";

/** Số một dòng của yêu cầu đang "giữ" trên dòng đơn (BE `ReturnLine.claimedUnits`). */
export function claimedUnits(line: ReturnLine, status: ReturnApiStatus): number {
  switch (status) {
    case "REQUESTED":
      return line.requestedQuantity;
    case "AWAITING_RETURN":
    case "RECEIVED":
    case "SETTLEMENT_PENDING":
      return line.approvedQuantity ?? 0;
    case "RESOLVED":
      return line.refundQuantity;
    default:
      return 0;
  }
}

/** Một lô đã giao của đơn: số đã giao trên lô theo dòng đơn (BE `OrderResponse.Shipment`, `status=DELIVERED`). */
export interface DeliveredShipment {
  shipmentId: string;
  lines: readonly { lineId: string; quantity: number }[];
}

const add = (map: Map<string, number>, key: string, n: number) =>
  map.set(key, (map.get(key) ?? 0) + n);

/**
 * Còn trả được bao nhiêu trên mỗi dòng đơn (BE `ReturnRequest.open`, `RETURN_QUANTITY_EXCEEDED`):
 * - đã giao − phần mọi yêu cầu khác của đơn đang giữ;
 * - WF-05 TH-1: có `shipment` thì thêm trần số đã giao **trên lô đó** − phần các yêu cầu khác của cùng lô; dòng chỉ bị
 *   khoá (`RETURN_LINE_ALREADY_OPEN`) khi một yêu cầu đang mở **của cùng lô** giữ nó. `shipment` null = đơn giao không
 *   qua lô (cùng "lô" là các yêu cầu không có `shipmentId`).
 */
export function openCaps(
  orderLines: readonly { lineId: string; deliveredQuantity: number }[],
  returns: readonly (Pick<ReturnRequest, "status" | "lines"> & { shipmentId?: string | null })[],
  isOpen: (status: ReturnApiStatus) => boolean,
  shipment: DeliveredShipment | null = null,
): Map<string, number> {
  const claimed = new Map<string, number>();
  const claimedHere = new Map<string, number>();
  const locked = new Set<string>();
  for (const ret of returns) {
    const sameDelivery = (ret.shipmentId ?? null) === (shipment?.shipmentId ?? null);
    for (const line of ret.lines) {
      const units = claimedUnits(line, ret.status);
      add(claimed, line.orderLineId, units);
      if (!sameDelivery) continue;
      add(claimedHere, line.orderLineId, units);
      if (isOpen(ret.status)) locked.add(line.orderLineId);
    }
  }
  const onShipment = new Map(shipment?.lines.map((l) => [l.lineId, l.quantity]) ?? []);
  return new Map(
    orderLines.map((line) => {
      if (locked.has(line.lineId)) return [line.lineId, 0];
      const overall = line.deliveredQuantity - (claimed.get(line.lineId) ?? 0);
      const here = shipment
        ? (onShipment.get(line.lineId) ?? 0) - (claimedHere.get(line.lineId) ?? 0)
        : overall;
      return [line.lineId, Math.max(0, Math.min(overall, here))];
    }),
  );
}

/** Dòng đơn có hàng trên lô (đơn không qua lô: mọi dòng). */
export function linesOnShipment<T extends { lineId: string }>(
  orderLines: readonly T[],
  shipment: DeliveredShipment | null,
): T[] {
  if (!shipment) return [...orderLines];
  const on = new Set(shipment.lines.filter((l) => l.quantity > 0).map((l) => l.lineId));
  return orderLines.filter((line) => on.has(line.lineId));
}

/** Trần hoàn của một dòng: đã duyệt và đã về kho (BE `ReturnLine.refundableUnits`). */
export const refundableUnits = (line: ReturnLine): number =>
  Math.min(line.approvedQuantity ?? 0, line.receivedQuantity ?? 0);

/** Tổng số đơn vị hoàn được của yêu cầu — 0 thì chỉ còn "Kết thúc không hoàn tiền" (BE `closeWithoutRefund`). */
export const totalRefundableUnits = (lines: readonly ReturnLine[]): number =>
  lines.reduce((sum, line) => sum + refundableUnits(line), 0);

/**
 * Đã có kiện hàng của yêu cầu về kho (BE `ReturnRequest.anyParcel`): phiếu đầu tiên hoặc một lần hàng về. Khi đó không
 * rút được nữa (`RETURN_GOODS_PARTLY_RECEIVED`) và Sale chốt bằng "Đã nhận đủ hàng" (WF-05 TH-3).
 */
export const hasGoodsBack = (receipt: ReturnRequest["receipt"]): boolean =>
  !!receipt?.goodsReceiptId || (receipt?.parcels?.length ?? 0) > 0;

/** Ảnh bằng chứng: JPEG / PNG / WebP ≤ 15 MB (BE `ContentTypePolicy` của ảnh trả hàng) — null là hợp lệ. */
export function evidenceFileProblem(file: { type: string; size: number }): string | null {
  if (!(RETURN_LIMITS.evidenceTypes as readonly string[]).includes(file.type))
    return RETURN_LABELS.detail.photoWrongType;
  if (file.size <= 0 || file.size > RETURN_LIMITS.evidenceMaxBytes)
    return RETURN_LABELS.detail.photoTooLarge;
  return null;
}

/** Giá trị dự kiến của đề xuất (đơn giá dòng × SL) — BE tính lại gồm VAT, đây chỉ là ước tính trước thuế. */
export function proposedValue(
  lines: readonly ReturnLine[],
  quantities: ReadonlyMap<string, number>,
): number {
  return lines.reduce((sum, line) => sum + line.unitPrice * (quantities.get(line.id) ?? 0), 0);
}

export interface ScanProgress {
  scanned: number;
  expected: number;
  /** Thùng của nguồn chưa quét. */
  missing: ExpectedCarton[];
  /** Thùng đã quét nhưng không có trong danh sách của nguồn (BE vẫn chặn `RETURN_CARTON_NOT_OF_SOURCE`). */
  extra: number;
}

/** So thùng đã quét với thùng của nguồn (docs 03 §4.2 bước 11) — quét thiếu vẫn xác nhận được. */
export function scanProgress(
  receipt: Pick<ReturnReceipt, "cartons" | "expectedCartons">,
): ScanProgress {
  const expectedLpns = new Set(receipt.expectedCartons.map((carton) => carton.lpn));
  return {
    scanned: receipt.cartons.length,
    expected: receipt.expectedCartons.length,
    missing: receipt.expectedCartons.filter((carton) => !carton.scanned),
    extra: receipt.cartons.filter((carton) => !expectedLpns.has(carton.lpn)).length,
  };
}

const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;

/**
 * Hết hạn đổi / trả lúc 0 giờ (giờ VN) của ngày thứ `days + 1` sau ngày giao (BE `ReturnPolicy.endOfDays`, BR-RMA-001).
 */
export function returnWindowEnd(deliveredAtIso: string, days: number): Date {
  const local = Date.parse(deliveredAtIso) + VN_OFFSET_MS;
  const startOfLocalDay = Math.floor(local / DAY_MS) * DAY_MS;
  return new Date(startOfLocalDay + (days + 1) * DAY_MS - VN_OFFSET_MS);
}

/** Đã quá hạn đổi / trả: Sale mở thay khách phải ghi lý do nhận ngoài hạn (BE `RETURN_WINDOW_CLOSED`). */
export function windowClosed(deliveredAtIso: string | null, days: number, now: Date): boolean {
  return !!deliveredAtIso && returnWindowEnd(deliveredAtIso, days).getTime() <= now.getTime();
}

/** Một dòng của form mở yêu cầu: dòng đơn có trên lô, kèm trần còn trả được. */
export interface OpenLine {
  lineId: string;
  sku: string;
  customPrinted: boolean;
  cap: number;
}

/** Dòng mở được cho một lô (WF-05 TH-1): chỉ dòng có hàng trên lô, trần theo `openCaps`. */
export function openLines(
  orderLines: readonly {
    lineId: string;
    sku: string;
    deliveredQuantity: number;
    customPrinted: boolean;
  }[],
  returns: Parameters<typeof openCaps>[1],
  isOpen: (status: ReturnApiStatus) => boolean,
  shipment: DeliveredShipment | null,
): OpenLine[] {
  const caps = openCaps(orderLines, returns, isOpen, shipment);
  return linesOnShipment(orderLines, shipment).map((line) => ({
    lineId: line.lineId,
    sku: line.sku,
    customPrinted: line.customPrinted,
    cap: caps.get(line.lineId) ?? 0,
  }));
}
