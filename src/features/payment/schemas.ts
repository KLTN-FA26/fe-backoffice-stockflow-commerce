/**
 * Thanh toán theo hợp đồng — DTO của BE (payment module: `InstallmentController`,
 * `PaymentReceiptController`, `RefundController`). Schema nhập liệu của form: `input-schemas.ts`.
 * Jackson `non_null` bỏ trường chưa đặt → `.nullish()`. Số tiền là `BigDecimal` → JSON number.
 * Docs: ecommerce/15-payment.
 */

import { z } from "zod";

import {
  INSTALLMENT_API_STATUSES,
  INSTALLMENT_MILESTONES,
  ORDER_PAYMENT_API_STATUSES,
  RECEIPT_API_STATUSES,
  REFUND_API_STATUSES,
  SETTLEMENT_KINDS,
} from "@/constants/payment";
import { bePageSchema } from "@/lib/api/page-schema";

/* ── DTO: đợt thanh toán ─────────────────────────────────────────────── */

export const installmentReceiptDtoSchema = z.object({
  receiptId: z.string(),
  reference: z.string(),
  receivedOn: z.string(),
  amount: z.number(),
  status: z.enum(RECEIPT_API_STATUSES),
  recordedAt: z.string(),
});

/** BE `InstallmentResponse`; `receipts` chỉ có ở chi tiết. */
export const installmentDtoSchema = z.object({
  installmentId: z.string(),
  contractId: z.string(),
  contractNumber: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string(),
  seq: z.number().int(),
  name: z.string(),
  milestone: z.enum(INSTALLMENT_MILESTONES),
  deliveryBatchSeq: z.number().int().nullish(),
  amount: z.number(),
  paidAmount: z.number(),
  reducedAmount: z.number(),
  outstanding: z.number(),
  currency: z.string(),
  dueDays: z.number().int().nullish(),
  reachedAt: z.string().nullish(),
  dueDate: z.string().nullish(),
  status: z.enum(INSTALLMENT_API_STATUSES),
  /** Đã qua hạn trả mà chưa trả đủ — CỜ tính khi đọc, không phải trạng thái (WF-05 fix plan §8). */
  overdue: z.boolean(),
  paidAt: z.string().nullish(),
  cancelledAt: z.string().nullish(),
  transferReference: z.string(),
  receipts: z.array(installmentReceiptDtoSchema).nullish(),
});
export const installmentPageDtoSchema = bePageSchema(installmentDtoSchema);

/** BE `OrderInstallmentsResponse` — trạng thái thanh toán tính từ các đợt chưa huỷ (docs 15 §5.2). */
export const orderInstallmentsDtoSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  contractNumber: z.string(),
  paymentStatus: z.enum(ORDER_PAYMENT_API_STATUSES).nullish(),
  total: z.number(),
  paid: z.number(),
  outstanding: z.number(),
  onSigningPaid: z.boolean(),
  beforeDeliveryUnpaid: z.number(),
  dueBeforeHandover: z.number(),
  currency: z.string(),
  installments: z.array(installmentDtoSchema),
});

/* ── DTO: phiếu thu ──────────────────────────────────────────────────── */

export const receiptLineDtoSchema = z.object({
  installmentId: z.string(),
  amount: z.number(),
  contractNumber: z.string().nullish(),
  orderId: z.string().nullish(),
  orderNumber: z.string().nullish(),
  seq: z.number().int().nullish(),
  name: z.string().nullish(),
  milestone: z.enum(INSTALLMENT_MILESTONES).nullish(),
});

/** BE `PaymentReceiptResponse`; `lines` có cả ở danh sách (mỗi dòng không kèm thông tin đợt). */
export const receiptDtoSchema = z.object({
  receiptId: z.string(),
  customerId: z.string(),
  reference: z.string(),
  receivedOn: z.string(),
  amount: z.number(),
  currency: z.string(),
  note: z.string().nullish(),
  status: z.enum(RECEIPT_API_STATUSES),
  recordedBy: z.string().nullish(),
  recordedAt: z.string(),
  voidedBy: z.string().nullish(),
  voidedAt: z.string().nullish(),
  voidReason: z.string().nullish(),
  lines: z.array(receiptLineDtoSchema),
});
export const receiptPageDtoSchema = bePageSchema(receiptDtoSchema);

/* ── DTO: hoàn tiền ──────────────────────────────────────────────────── */

export const refundRecordDtoSchema = z.object({
  refundRecordId: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string(),
  amount: z.number(),
  currency: z.string(),
  refundedOn: z.string(),
  reference: z.string(),
  note: z.string().nullish(),
  status: z.enum(RECEIPT_API_STATUSES),
  recordedBy: z.string().nullish(),
  recordedAt: z.string(),
  voidedBy: z.string().nullish(),
  voidedAt: z.string().nullish(),
  voidReason: z.string().nullish(),
});

const settlementDtoSchema = z.object({
  settlementId: z.string(),
  kind: z.enum(SETTLEMENT_KINDS),
  collected: z.number(),
  closed: z.number(),
  reduced: z.number(),
  surplus: z.number(),
  fee: z.number(),
  feePercent: z.number().nullish(),
  feeReason: z.string().nullish(),
  feeDetail: z.string().nullish(),
  feeCovered: z.number(),
  refundable: z.number(),
  feeOwed: z.number(),
  feeItemId: z.string().nullish(),
  settledAt: z.string(),
});

/** BE `OrderRefundResponse`; `settlements` / `records` vắng ở danh sách. */
export const orderRefundDtoSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  currency: z.string(),
  refundStatus: z.enum(REFUND_API_STATUSES),
  refundable: z.number(),
  refunded: z.number(),
  remaining: z.number(),
  settlements: z.array(settlementDtoSchema).nullish(),
  records: z.array(refundRecordDtoSchema).nullish(),
});
export const orderRefundPageDtoSchema = bePageSchema(orderRefundDtoSchema);
