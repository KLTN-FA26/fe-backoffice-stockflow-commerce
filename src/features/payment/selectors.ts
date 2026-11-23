/** Selector thuần cho thanh toán theo hợp đồng (docs 15). */

import { INSTALLMENT_STATUS_BY_API, RECEIPT_STATUS_BY_API } from "@/constants/payment";
import {
  INSTALLMENT_MILESTONE_LABELS,
  PAYMENT_LABELS,
  PAYMENT_LIST_LABELS,
} from "@/constants/labels-payment";
import { daysBetween, todayIso } from "@/lib/date-range";
import { statusLabelVi } from "@/lib/status-map";

import { installmentTakesMoney } from "./lifecycle";

import type {
  InstallmentDisplayStatus,
  InstallmentReadStatus,
  ReceiptReadStatus,
} from "@/constants/payment";
import type { Installment, ReceiptFormValues } from "./types";

const L = PAYMENT_LABELS.installments;

/** Nhãn tiếng Việt; trạng thái chưa có nhãn → "Không rõ", không lộ mã tiếng Anh ("Partially Paid") — BO-UX-6. */
export function installmentStatusLabel(status: InstallmentReadStatus): string {
  return (
    statusLabelVi(INSTALLMENT_STATUS_BY_API[status], "payment") ?? PAYMENT_LIST_LABELS.unknownStatus
  );
}

/**
 * Trạng thái hiển thị của đợt: đợt còn nợ đã qua hạn trả hiện "Overdue" (cờ `overdue` của BE —
 * quá hạn không còn là trạng thái, WF-05 fix plan §8; docs 15 §4.1 bước 4).
 */
export function displayStatus(
  installment: Pick<Installment, "status" | "overdue">,
): InstallmentDisplayStatus {
  return installment.overdue ? "OVERDUE" : installment.status;
}

export function receiptStatusLabel(status: ReceiptReadStatus): string {
  return (
    statusLabelVi(RECEIPT_STATUS_BY_API[status], "payment") ?? PAYMENT_LIST_LABELS.unknownStatus
  );
}

/**
 * Số ngày quá hạn của đợt: R5-12 `daysOverdue` khi BE gửi, không thì tính từ hạn trả tới hôm nay (giờ Việt Nam). Đợt
 * không có cờ `overdue` → 0.
 */
export function daysOverdue(
  installment: Pick<Installment, "overdue" | "dueDate"> & { daysOverdue?: number | null },
  today: string = todayIso(),
): number {
  if (!installment.overdue) return 0;
  if (installment.daysOverdue != null) return installment.daysOverdue;
  const due = installment.dueDate;
  return due ? Math.max(0, daysBetween(due.slice(0, 10), today)) : 0;
}

export function milestoneLabel(milestone: Installment["milestone"]): string {
  return INSTALLMENT_MILESTONE_LABELS[milestone];
}

/** "Đợt giao 2" khi đợt gắn đợt giao (docs 15 §4.1, BR-08); không gắn → "Không gắn đợt giao". */
export function deliveryBatchLabel(installment: Pick<Installment, "deliveryBatchSeq">): string {
  return installment.deliveryBatchSeq == null
    ? L.notTied
    : L.batchTied(installment.deliveryBatchSeq);
}

/**
 * Đợt đang chặn bàn giao: `BEFORE_DELIVERY` chưa `Paid` / `Cancelled` (docs 15 BR-08). Đợt gắn đợt
 * giao k chỉ chặn bàn giao của đợt k; đợt không gắn chặn từ lần bàn giao đầu — nhãn kèm `deliveryBatchLabel`.
 */
export function blocksHandover(installment: Pick<Installment, "milestone" | "status">): boolean {
  return installment.milestone === "BEFORE_DELIVERY" && installmentTakesMoney(installment.status);
}

/** Đợt có thể thêm vào phiếu thu (còn nhận tiền và còn số phải thu > 0). */
export function payableInstallments(installments: readonly Installment[]): Installment[] {
  return installments.filter((i) => installmentTakesMoney(i.status) && i.outstanding > 0);
}

/** Tổng các dòng của form phiếu thu — dòng chưa nhập số hợp lệ tính 0. */
export function receiptFormTotal(lines: ReceiptFormValues["lines"]): number {
  return lines.reduce((sum, line) => {
    const amount = /^\d+$/.test(line.amount.trim()) ? Number(line.amount.trim()) : 0;
    return sum + amount;
  }, 0);
}

/** Tên đợt hiển thị: "Đợt 2 — Thanh toán trước khi giao". */
export function installmentTitle(installment: Pick<Installment, "seq" | "name">): string {
  return `Đợt ${installment.seq} — ${installment.name}`;
}
