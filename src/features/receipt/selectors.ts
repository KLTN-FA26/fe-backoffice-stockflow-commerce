/**
 * Goods receipt — selectors THUẦN (không side effect), derive từ data đã parse.
 */

import { QC_OUTCOME_BY_API, RECEIPT_QC_PROGRESS_STATUS, RECEIPT_STATUS } from "@/constants";
import { toLocalIsoDate } from "@/lib/format/date";

import type { QcOutcomeStatus, ReceiptStatus } from "@/constants";
import type {
  GoodsReceipt,
  ReceiptLineDto,
  ReceiptLineValues,
  ReceiptLinesFormInput,
  ReceivablePo,
  ReceivablePoLine,
} from "./types";

type CountedLine = Pick<ReceiptLineValues, "purchaseOrderLineId" | "quantity">;

/**
 * BR-02 (docs 03 §6): SL tối đa của một dòng PO = SL đặt × (1 + dung sai %), làm tròn xuống —
 * đúng cách BE tính (`ReceivingPurchaseOrder.Line#receivableLimit`).
 */
export function receivableLimit(orderedQuantity: number, tolerancePercent: number): number {
  return Math.floor((orderedQuantity * (100 + tolerancePercent)) / 100);
}

/** Tổng SL đang kiểm đếm theo từng dòng PO (một dòng PO có thể tách nhiều lô). */
export function countedByPoLine(lines: readonly CountedLine[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const line of lines) {
    totals[line.purchaseOrderLineId] = (totals[line.purchaseOrderLineId] ?? 0) + line.quantity;
  }
  return totals;
}

/**
 * Dòng PO đang đếm vượt SL còn mở → CẢNH BÁO (vẫn cho lưu). Nhận thừa trong dung sai được
 * chấp nhận (docs 03 bước 5); vượt dung sai BE chặn bằng `OVER_RECEIPT_TOLERANCE`.
 */
export function poLinesOverOpenQuantity(
  poLines: readonly ReceivablePoLine[],
  lines: readonly CountedLine[],
): readonly string[] {
  const counted = countedByPoLine(lines);
  return poLines
    .filter((poLine) => (counted[poLine.lineId] ?? 0) > poLine.openQuantity)
    .map((poLine) => poLine.lineId);
}

/** Ngày nhận theo giờ VN (yyyy-MM-dd) — mốc so hạn dùng của BR-06. */
export function receiptReceivedOn(receipt: Pick<GoodsReceipt, "receivedAt">): string {
  return toLocalIsoDate(receipt.receivedAt);
}

/**
 * Giá trị khởi tạo form kiểm đếm: phiếu đã lưu thì lấy dòng đã lưu; chưa lưu thì gợi ý mỗi dòng
 * PO còn mở một dòng, SL = SL còn mở (docs 03 bước 1: nạp dòng còn open làm dòng dự kiến).
 */
export function initialCountLines(
  receipt: Pick<GoodsReceipt, "lines">,
  po: Pick<ReceivablePo, "lines"> | undefined,
): ReceiptLinesFormInput["lines"] {
  if (receipt.lines.length > 0) {
    return receipt.lines.map((line) => ({
      purchaseOrderLineId: line.purchaseOrderLineId,
      quantity: line.quantity,
      lotNumber: line.lotNumber ?? "",
      expiryDate: line.expiryDate ?? "",
      locationCode: line.locationCode ?? "",
      note: line.note ?? "",
    }));
  }
  return (po?.lines ?? [])
    .filter((poLine) => poLine.openQuantity > 0)
    .map((poLine) => ({
      purchaseOrderLineId: poLine.lineId,
      quantity: poLine.openQuantity,
      lotNumber: "",
      expiryDate: "",
      locationCode: "",
      note: "",
    }));
}

export function totalReceivedQuantity(receipt: Pick<GoodsReceipt, "lines">): number {
  return receipt.lines.reduce((sum, line) => sum + line.quantity, 0);
}

/* ── QC ──────────────────────────────────────────────────────────────── */

/** SL đã chuyển sang khu QC của một dòng — BE chuyển nguyên SL nhận (`moveToQc`). */
export function movedToQcQuantity(line: Pick<ReceiptLineDto, "quantity">): number {
  return line.quantity;
}

export interface InspectionTotals {
  accepted: number;
  quarantined: number;
  rejected: number;
}

export function inspectionTotals(line: Pick<ReceiptLineDto, "inspections">): InspectionTotals {
  const totals: InspectionTotals = { accepted: 0, quarantined: 0, rejected: 0 };
  for (const inspection of line.inspections) {
    if (inspection.outcome === "ACCEPTED") totals.accepted += inspection.quantity;
    else if (inspection.outcome === "QUARANTINE") totals.quarantined += inspection.quantity;
    else totals.rejected += inspection.quantity;
  }
  return totals;
}

/**
 * Trạng thái chất lượng hiển thị của dòng (docs 03 §5.2, nguyên văn): `Not Required` /
 * `Pending`, hoặc các kết luận đã có (`Accepted` / `Quarantine` / `Rejected`).
 */
export function lineQualityStatuses(
  line: Pick<ReceiptLineDto, "qcProgress" | "inspections">,
): readonly string[] {
  if (line.qcProgress !== "INSPECTED") return [RECEIPT_QC_PROGRESS_STATUS[line.qcProgress]];
  const outcomes = new Set<QcOutcomeStatus>(
    line.inspections.map((inspection) => QC_OUTCOME_BY_API[inspection.outcome]),
  );
  return [...outcomes];
}

/**
 * Số dòng còn chờ QC (chưa chuyển / đang ở khu QC) — chỉ khi phiếu đang `In QC`. BE tính
 * `qcProgress` không theo trạng thái phiếu (`GoodsReceiptServiceImpl#progress`): dòng cần QC của
 * phiếu nháp / đã huỷ vẫn là AWAITING_MOVE_TO_QC nhưng chưa (hoặc không bao giờ) phải QC.
 */
export function pendingQcLineCount(receipt: Pick<GoodsReceipt, "lines" | "status">): number {
  if (receipt.status !== RECEIPT_STATUS.IN_QC) return 0;
  return receipt.lines.filter(
    (line) => line.qcProgress === "AWAITING_MOVE_TO_QC" || line.qcProgress === "IN_QC_AREA",
  ).length;
}

/**
 * Trạng thái phiếu sau khi xác nhận — BE `GoodsReceipt#confirm`: có dòng cần QC → In QC, không có
 * → In Putaway (Confirmed chỉ đi qua trong cùng transaction).
 */
export function statusAfterConfirm(receipt: Pick<GoodsReceipt, "lines">): ReceiptStatus {
  return receipt.lines.some((line) => line.qcRequired)
    ? RECEIPT_STATUS.IN_QC
    : RECEIPT_STATUS.IN_PUTAWAY;
}

/** Số dòng đi luồng 3 bước (cần QC) trên phiếu. */
export function qcRequiredLineCount(receipt: Pick<GoodsReceipt, "lines">): number {
  return receipt.lines.filter((line) => line.qcRequired).length;
}
