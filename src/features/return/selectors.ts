/**
 * Selector thuần của trả hàng — trần số lượng theo BE `ReturnLine` (`claimedUnits`, `refundableUnits`) và tiến độ quét
 * của phiếu nhập hàng hoàn. Không side effect.
 */

import { RETURN_LABELS, RETURN_RECEIPT_LABELS } from "@/constants/labels-return";
import { RETURN_EVIDENCE_STAGES, RETURN_LIMITS } from "@/constants/returns";

import type { ReturnReadStatus } from "@/constants/returns";
import type { ExpectedCarton, ReturnLine, ReturnReceipt, ReturnRequest } from "./types";

/**
 * Số một dòng của yêu cầu đang "giữ" trên dòng đơn — chép BE G4 `ReturnLine.claimedUnits`. WF-05 BE-21: hàng đã về kho luôn tính
 * là đã khiếu nại — kể cả khi hoàn 0 đồng (Q-4) hay yêu cầu đã hết hạn / bị rút sau khi hàng về — để không trả hai lần
 * cùng một đơn vị. Trạng thái lạ (UNKNOWN): lấy số lớn nhất đã biết của dòng, trần mở yêu cầu mới chỉ chặt hơn (BE kiểm
 * lại).
 */
export function claimedUnits(line: ReturnLine, status: ReturnReadStatus): number {
  const received = line.receivedQuantity ?? 0;
  switch (status) {
    case "REQUESTED":
      return Math.max(line.requestedQuantity, received);
    case "AWAITING_RETURN":
    case "RECEIVED":
    case "SETTLEMENT_PENDING":
      return Math.max(line.approvedQuantity ?? 0, received);
    case "RESOLVED":
      return Math.max(line.refundQuantity, received);
    case "INSPECTED":
    case "REJECTED":
    case "EXPIRED":
    case "CANCELLED":
      return received;
    case "UNKNOWN":
      return Math.max(
        line.requestedQuantity,
        line.approvedQuantity ?? 0,
        received,
        line.refundQuantity,
      );
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
  isOpen: (status: ReturnReadStatus) => boolean,
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

/**
 * Ảnh khiếu nại của khách (stage CLAIM, và ảnh cũ không rõ bước) — tách khỏi biên nhận giữ hộ (WF-05 Q-11): BE đếm trần
 * `evidenceMax` theo từng bước, và "cần ít nhất một ảnh trước khi duyệt" chỉ nói về ảnh khiếu nại.
 */
export const claimEvidence = (ret: Pick<ReturnRequest, "evidence">) =>
  (ret.evidence ?? []).filter((photo) => photo.stage !== RETURN_EVIDENCE_STAGES.custody);

/** Biên nhận giữ hộ (WF-05 Q-11, stage CUSTODY): hàng về mà phiếu nhập không nhận. */
export const custodyEvidence = (ret: Pick<ReturnRequest, "evidence">) =>
  (ret.evidence ?? []).filter((photo) => photo.stage === RETURN_EVIDENCE_STAGES.custody);

/** Ảnh hàng lẻ (WF-05 Q-18): JPEG / PNG ≤ 20 MB như ảnh nhận hàng của phiếu nhập — null là hợp lệ. */
export function loosePhotoProblem(file: { type: string; size: number } | null): string | null {
  const D = RETURN_RECEIPT_LABELS.detail.loose;
  if (!file) return D.photoRequired;
  if (!(RETURN_LIMITS.loosePhotoTypes as readonly string[]).includes(file.type))
    return D.photoWrongType;
  if (file.size <= 0 || file.size > RETURN_LIMITS.loosePhotoMaxBytes) return D.photoTooLarge;
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
  isOpen: (status: ReturnReadStatus) => boolean,
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

/**
 * Đề xuất đang chờ duyệt là "không hoàn tiền" (WF-05 Q-4): không dòng nào hoàn đơn vị nào (BE G4 ghi số đề xuất vào
 * `refundQuantity` của dòng). Theo SỐ ĐƠN VỊ, không theo số tiền: đơn chưa thu đồng nào vẫn "hoàn" đơn vị với giá trị 0,
 * và một đề xuất giữ lại một phần có thể kèm lý do mà vẫn hoàn tiền. Nút duyệt vẫn là "Duyệt hoàn tiền" sẵn có, chỉ câu
 * chữ trong hộp thoại đổi theo.
 */
export function proposesNoRefund(ret: Pick<ReturnRequest, "lines" | "resolution">): boolean {
  if ((ret.resolution?.settlementAmount ?? 0) > 0) return false;
  return ret.lines.every((line) => line.refundQuantity === 0);
}

/**
 * Kết quả của yêu cầu đã xử lý xong: `outcome` của BE khi có (F-20); BE cũ thì suy như BE G4 `ReturnRequest.outcomeOf` —
 * có đơn vị được hoàn (hoặc giá trị hoàn > 0) → REFUNDED, không có mà có lý do → REFUSED, còn lại NOTHING_TO_REFUND. Một yêu cầu không hoàn đơn
 * vị nào không bao giờ đọc là "Đã hoàn tiền". `null` = chưa xử lý xong.
 */
export function returnOutcome(
  ret: Pick<ReturnRequest, "status" | "outcome" | "refusalReason" | "lines" | "resolution">,
): NonNullable<ReturnRequest["outcome"]> | null {
  if (ret.outcome) return ret.outcome;
  if (ret.status !== "RESOLVED") return null;
  const refundedUnits = ret.lines.some((line) => line.refundQuantity > 0);
  if (refundedUnits || (ret.resolution?.settlementAmount ?? 0) > 0) return "REFUNDED";
  return ret.refusalReason != null ? "REFUSED" : "NOTHING_TO_REFUND";
}
