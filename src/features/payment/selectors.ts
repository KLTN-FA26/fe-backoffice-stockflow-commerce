/** Selector thuần cho thanh toán theo hợp đồng (docs 15). */

import { INSTALLMENT_STATUS_BY_API, RECEIPT_STATUS_BY_API } from "@/constants/payment";
import { INSTALLMENT_MILESTONE_LABELS, PAYMENT_LABELS } from "@/constants/labels-payment";
import { statusLabelVi } from "@/lib/status-map";

import { installmentTakesMoney } from "./lifecycle";

import type { InstallmentApiStatus, ReceiptApiStatus } from "@/constants/payment";
import type { Installment, ReceiptFormValues } from "./types";

const L = PAYMENT_LABELS.installments;

export function installmentStatusLabel(status: InstallmentApiStatus): string {
  const key = INSTALLMENT_STATUS_BY_API[status];
  return statusLabelVi(key, "payment") ?? key;
}

export function receiptStatusLabel(status: ReceiptApiStatus): string {
  const key = RECEIPT_STATUS_BY_API[status];
  return statusLabelVi(key, "payment") ?? key;
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
