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
import { omittedOrNull } from "@/lib/validation/primitives";

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
  /** Tên + mã khách BE kèm sẵn (BE-15) — kế toán không có quyền xem hồ sơ khách. */
  customerName: z.string().nullish(),
  customerCode: z.string().nullish(),
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
  /** R5-12 (BE round 5, có thể chưa có): ngày hạn + số ngày quá hạn (0 khi chưa quá hạn). */
  dueOn: z.string().nullish(),
  daysOverdue: z.number().int().nullish(),
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
  customerName: z.string().nullish(),
  customerCode: z.string().nullish(),
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
  /** R5-8 (BE round 5, có thể chưa có): tên người lập / người huỷ — không có thì không hiện dòng đó. */
  recordedByName: z.string().nullish(),
  voidedByName: z.string().nullish(),
});
export const receiptPageDtoSchema = bePageSchema(receiptDtoSchema);

/**
 * BE `PaymentReceiptSummaryResponse` (`GET /payment-receipts/summary`, cùng bộ lọc, không tính phiếu VOIDED).
 * `totalAmount` / `currency` vắng khi các phiếu có nhiều loại tiền — lúc đó đọc `byCurrency`.
 */
export const receiptSummaryDtoSchema = z.object({
  count: z.number().int(),
  totalAmount: omittedOrNull(z.number()),
  currency: omittedOrNull(z.string()),
  byCurrency: z.array(
    z.object({ currency: z.string(), count: z.number().int(), totalAmount: z.number() }),
  ),
});

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

/* ── Công nợ phải thu theo khách (R5-11) ──────────────────────────────── */

/**
 * One row of the BE receivables report `GET /reports/receivables` (`reporting` module, already there before round 5;
 * round 5 added `search`). The BE leaves null fields out of the JSON.
 */
export const receivableReportRowDtoSchema = z.object({
  customerId: z.string(),
  customerCode: z.string().nullish(),
  customerName: z.string().nullish(),
  receivable: z.number(),
  overdue: z.number(),
  overdue1To30: z.number().nullish(),
  overdue31To60: z.number().nullish(),
  overdue61To90: z.number().nullish(),
  overdueOver90: z.number().nullish(),
  oldestDueDate: z.string().nullish(),
  openItems: z.number().int().nullish(),
});
export const receivableReportDtoSchema = z.object({
  asOf: z.string().nullish(),
  rows: bePageSchema(receivableReportRowDtoSchema),
});

/** The screen's model of a receivable row (what `ReceivablesList` renders). */
export const receivableDtoSchema = z.object({
  customerId: z.string(),
  customerName: z.string().nullish(),
  customerCode: z.string().nullish(),
  taxCode: z.string().nullish(),
  owed: z.number(),
  overdue: z.number(),
  oldestDueOn: z.string().nullish(),
  aging: z.object({ d0to30: z.number(), d31to60: z.number(), over60: z.number() }).nullish(),
  installmentCount: z.number().int().nullish(),
});
export const receivablePageDtoSchema = bePageSchema(receivableDtoSchema);
