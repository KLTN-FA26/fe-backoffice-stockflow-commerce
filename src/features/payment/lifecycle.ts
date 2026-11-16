/**
 * Vòng đời đợt thanh toán và phiếu thu — chép bảng "Chuyển tiếp cho phép" của docs 15 §5.1, §5.3.
 * Trạng thái do hệ thống tính (phiếu thu, quét đêm), người dùng chỉ lập / huỷ phiếu thu và ghi nhận
 * hoàn. UI-only — Backend phải re-check (quyền `payment-receipts` / `payment-refunds`, BR-03, BR-05, BR-13).
 */

import {
  INSTALLMENT_PAYABLE_STATUSES,
  PAYMENT_RECEIPT_PERMISSIONS,
  PAYMENT_REFUND_PERMISSIONS,
} from "@/constants/payment";

import type { InstallmentApiStatus, ReceiptApiStatus } from "@/constants/payment";
import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { OrderRefund, RefundRecord } from "./types";

/** docs 15 §5.1 — `Paid` và `Cancelled` là cuối (huỷ phiếu thu thì tính lại, không phải chuyển tiếp). */
export const INSTALLMENT_TRANSITIONS: Readonly<
  Record<InstallmentApiStatus, readonly InstallmentApiStatus[]>
> = {
  NOT_DUE: ["DUE", "PARTIALLY_PAID", "PAID", "CANCELLED"],
  DUE: ["PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"],
  PARTIALLY_PAID: ["PAID", "OVERDUE", "CANCELLED"],
  OVERDUE: ["PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

/** docs 15 §5.3 — phiếu thu `Recorded` chỉ chuyển được sang `Voided` (BR-04: không sửa). */
export const RECEIPT_TRANSITIONS: Readonly<Record<ReceiptApiStatus, readonly ReceiptApiStatus[]>> =
  {
    RECORDED: ["VOIDED"],
    VOIDED: [],
  };

export type PaymentAction = "recordReceipt" | "voidReceipt" | "recordRefund" | "voidRefundRecord";

const NEEDS: Readonly<Record<PaymentAction, PermissionCode>> = {
  recordReceipt: PAYMENT_RECEIPT_PERMISSIONS.create,
  voidReceipt: PAYMENT_RECEIPT_PERMISSIONS.update,
  recordRefund: PAYMENT_REFUND_PERMISSIONS.create,
  voidRefundRecord: PAYMENT_REFUND_PERMISSIONS.update,
};

type Can = (code: PermissionCode) => boolean;

/** Đợt còn nhận tiền: chưa `Paid` / `Cancelled` (docs 15 BR-05; kể cả `Not Due` — khách trả sớm). */
export function installmentTakesMoney(status: InstallmentApiStatus): boolean {
  return (INSTALLMENT_PAYABLE_STATUSES as readonly InstallmentApiStatus[]).includes(status);
}

export function allowedInstallmentActions(
  installment: { status: InstallmentApiStatus },
  can: Can,
): PaymentAction[] {
  return installmentTakesMoney(installment.status) && can(NEEDS.recordReceipt)
    ? ["recordReceipt"]
    : [];
}

export function allowedReceiptActions(
  receipt: { status: ReceiptApiStatus },
  can: Can,
): PaymentAction[] {
  return RECEIPT_TRANSITIONS[receipt.status].includes("VOIDED") && can(NEEDS.voidReceipt)
    ? ["voidReceipt"]
    : [];
}

/** Ghi nhận hoàn khi còn số phải hoàn (BR-14: tổng ghi nhận không vượt số phải hoàn). */
export function allowedRefundActions(
  refund: Pick<OrderRefund, "remaining">,
  can: Can,
): PaymentAction[] {
  return refund.remaining > 0 && can(NEEDS.recordRefund) ? ["recordRefund"] : [];
}

export function allowedRefundRecordActions(
  record: Pick<RefundRecord, "status">,
  can: Can,
): PaymentAction[] {
  return record.status === "RECORDED" && can(NEEDS.voidRefundRecord) ? ["voidRefundRecord"] : [];
}
