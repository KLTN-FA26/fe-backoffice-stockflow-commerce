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

import type {
  InstallmentApiStatus,
  InstallmentReadStatus,
  ReceiptApiStatus,
  ReceiptReadStatus,
} from "@/constants/payment";
import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { OrderRefund, RefundRecord } from "./types";

/**
 * docs 15 §5.1 — `Paid` và `Cancelled` là cuối (huỷ phiếu thu thì tính lại, không phải chuyển tiếp). Trạng thái BE thêm sau
 * (UNKNOWN, WF-05 BO-11): FE không đoán — không thao tác.
 */
export const INSTALLMENT_TRANSITIONS: Readonly<
  Record<InstallmentReadStatus, readonly InstallmentApiStatus[]>
> = {
  NOT_DUE: ["DUE", "PARTIALLY_PAID", "PAID", "CANCELLED"],
  DUE: ["PARTIALLY_PAID", "PAID", "CANCELLED"],
  PARTIALLY_PAID: ["PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
  UNKNOWN: [],
};

/** docs 15 §5.3 — phiếu thu `Recorded` chỉ chuyển được sang `Voided` (BR-04: không sửa). */
export const RECEIPT_TRANSITIONS: Readonly<Record<ReceiptReadStatus, readonly ReceiptApiStatus[]>> =
  {
    RECORDED: ["VOIDED"],
    VOIDED: [],
    UNKNOWN: [],
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
export function installmentTakesMoney(status: InstallmentReadStatus): boolean {
  return (INSTALLMENT_PAYABLE_STATUSES as readonly string[]).includes(status);
}

export function allowedInstallmentActions(
  installment: { status: InstallmentReadStatus },
  can: Can,
): PaymentAction[] {
  return installmentTakesMoney(installment.status) && can(NEEDS.recordReceipt)
    ? ["recordReceipt"]
    : [];
}

/**
 * Huỷ phiếu thu: RECORDED + quyền UPDATE, và BE không báo chặn (WF-05 Q-20, G2 `voidable`). `voidable === false` → khoá
 * (lý do ở `voidBlockedBy`, `receiptVoidBlock`); vắng (danh sách, BE cũ) → theo trạng thái, BE vẫn kiểm lại khi bấm.
 */
export function allowedReceiptActions(
  receipt: { status: ReceiptReadStatus; voidable?: boolean | null },
  can: Can,
): PaymentAction[] {
  return RECEIPT_TRANSITIONS[receipt.status].includes("VOIDED") &&
    receipt.voidable !== false &&
    can(NEEDS.voidReceipt)
    ? ["voidReceipt"]
    : [];
}

/**
 * Lý do BE không cho huỷ phiếu (G2 `voidBlockedBy`) — chỉ khi phiếu còn RECORDED, người xem có quyền huỷ và BE nói
 * `voidable: false`; null khi không có gì để nói. Mã lạ vẫn trả về (màn hiện câu "máy chủ không cho huỷ").
 */
export function receiptVoidBlock(
  receipt: { status: ReceiptReadStatus; voidable?: boolean | null; voidBlockedBy?: string | null },
  can: Can,
): string | null {
  if (receipt.status !== "RECORDED" || receipt.voidable !== false || !can(NEEDS.voidReceipt))
    return null;
  return receipt.voidBlockedBy ?? "UNKNOWN";
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
