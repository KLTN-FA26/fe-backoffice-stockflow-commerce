import { RECEIPT_STATUSES } from "@/constants";

import type {
  DiscrepancyRecord,
  Lot,
  QcStatus,
  Receipt,
  ReceiptLine,
  ReceiptStatus,
} from "./types";

export interface ReceiptStats {
  total: number;
  draft: number;
  active: number;
  closed: number;
  discrepancies: number;
}

export interface ReceiptTimelineStep {
  status: ReceiptStatus;
  label: string;
  active: boolean;
  completed: boolean;
}

export function computeReceiptStats(receipts: Receipt[]): ReceiptStats {
  return receipts.reduce<ReceiptStats>(
    (stats, receipt) => ({
      total: stats.total + 1,
      draft: stats.draft + (receipt.status === "Draft" ? 1 : 0),
      active: stats.active + (["Confirmed", "In Putaway"].includes(receipt.status) ? 1 : 0),
      closed: stats.closed + (receipt.status === "Closed" ? 1 : 0),
      discrepancies:
        stats.discrepancies +
        receipt.lines.filter((line) => line.discrepancyQty !== 0).length +
        (receipt.discrepancies?.length ?? 0),
    }),
    { total: 0, draft: 0, active: 0, closed: 0, discrepancies: 0 },
  );
}

export function totalOrderedQty(receipt: Receipt): number {
  return receipt.lines.reduce((sum, line) => sum + line.orderedQty, 0);
}

export function totalReceivedQty(receipt: Receipt): number {
  return receipt.lines.reduce((sum, line) => sum + line.receivedQty, 0);
}

export function receiptHasDiscrepancy(receipt: Receipt): boolean {
  return (
    receipt.lines.some((line) => line.discrepancyQty !== 0) ||
    Boolean(receipt.discrepancies?.length)
  );
}

export function lineDiscrepancyLabel(line: ReceiptLine): string {
  if (line.discrepancyQty === 0) return "Khớp dự kiến";
  const absQty = Math.abs(line.discrepancyQty).toLocaleString("vi-VN");
  return line.discrepancyQty > 0 ? `Thừa ${absQty} ${line.uom}` : `Thiếu ${absQty} ${line.uom}`;
}

export function discrepancyTypeLabel(type: DiscrepancyRecord["type"]): string {
  const labels: Record<DiscrepancyRecord["type"], string> = {
    damage: "Hư hỏng",
    over: "Nhận thừa",
    short: "Nhận thiếu",
  };
  return labels[type];
}

export function discrepancyStatusLabel(status: DiscrepancyRecord["status"]): string {
  return status === "open" ? "Đang mở" : "Đã xử lý";
}

export function lotsForLine(line: ReceiptLine, lots: Lot[]): Lot[] {
  const lotIds = new Set(line.lotIds);
  return lots.filter((lot) => lotIds.has(lot.lotId));
}

export function qcStatusForLine(line: ReceiptLine, lots: Lot[]): QcStatus | "Accepted" {
  const lineLots = lotsForLine(line, lots);
  if (lineLots.some((lot) => lot.qcStatus === "Rejected")) return "Rejected";
  if (lineLots.some((lot) => lot.qcStatus === "Quarantine")) return "Quarantine";
  return "Accepted";
}

export function buildReceiptTimeline(status: ReceiptStatus): ReceiptTimelineStep[] {
  if (status === "Cancelled") {
    return [
      { status: "Draft", label: "Nháp", active: false, completed: true },
      { status: "Cancelled", label: "Đã huỷ", active: true, completed: true },
    ];
  }

  const orderedStatuses = RECEIPT_STATUSES.filter((item) => item !== "Cancelled");
  const currentIndex = orderedStatuses.indexOf(status);

  return orderedStatuses.map((item, index) => ({
    status: item,
    label: receiptStatusLabel(item),
    active: item === status,
    completed: currentIndex >= index,
  }));
}

export function receiptStatusLabel(status: ReceiptStatus): string {
  const labels: Record<ReceiptStatus, string> = {
    Cancelled: "Đã huỷ",
    Closed: "Đã đóng",
    Confirmed: "Đã xác nhận",
    Draft: "Nháp",
    "In Putaway": "Đang cất hàng",
  };
  return labels[status];
}
