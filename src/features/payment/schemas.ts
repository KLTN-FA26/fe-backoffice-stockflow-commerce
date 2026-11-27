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
  PAYMENT_UNKNOWN,
  RECEIPT_API_STATUSES,
  REFUND_API_STATUSES,
  SETTLEMENT_KINDS,
} from "@/constants/payment";
import { bePageSchema } from "@/lib/api/page-schema";
import { omittedOrNull } from "@/lib/validation/primitives";

/**
 * Enum của BE đọc khoan dung (WF-05 BO-11, audit C-32; cùng cách `features/order/installments-summary-api.ts`): BE gửi
 * chuỗi và vẫn thêm giá trị mới (vd. loại tính hoàn `SHIPMENT_RETURNED`) — giá trị FE chưa biết đọc thành `UNKNOWN`
 * ("Không rõ", không thao tác) thay vì làm hỏng cả màn.
 */
function tolerantEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.enum([...values, PAYMENT_UNKNOWN]).catch(PAYMENT_UNKNOWN);
}

const receiptStatus = tolerantEnum(RECEIPT_API_STATUSES);
const milestone = tolerantEnum(INSTALLMENT_MILESTONES);

/* ── DTO: đợt thanh toán ─────────────────────────────────────────────── */

export const installmentReceiptDtoSchema = z.object({
  receiptId: z.string(),
  reference: z.string(),
  receivedOn: z.string(),
  amount: z.number(),
  status: receiptStatus,
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
  milestone,
  deliveryBatchSeq: z.number().int().nullish(),
  amount: z.number(),
  paidAmount: z.number(),
  reducedAmount: z.number(),
  outstanding: z.number(),
  currency: z.string(),
  dueDays: z.number().int().nullish(),
  reachedAt: z.string().nullish(),
  dueDate: z.string().nullish(),
  status: tolerantEnum(INSTALLMENT_API_STATUSES),
  /** Đã qua hạn trả mà chưa trả đủ — CỜ tính khi đọc, không phải trạng thái (WF-05 fix plan §8). */
  overdue: z.boolean(),
  paidAt: z.string().nullish(),
  cancelledAt: z.string().nullish(),
  transferReference: z.string(),
  receipts: z.array(installmentReceiptDtoSchema).nullish(),
  /** R5-12 (BE round 5, có thể chưa có): số ngày quá `dueDate` mà vẫn còn nợ (0 khi chưa quá hạn). */
  daysOverdue: z.number().int().nullish(),
});
export const installmentPageDtoSchema = bePageSchema(installmentDtoSchema);

/** BE `OrderInstallmentsResponse` — trạng thái thanh toán tính từ các đợt chưa huỷ (docs 15 §5.2). */
export const orderInstallmentsDtoSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  contractNumber: z.string(),
  paymentStatus: tolerantEnum(ORDER_PAYMENT_API_STATUSES).nullish(),
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
  milestone: milestone.nullish(),
});

/**
 * BE `PaymentReceiptResponse`; `lines` có cả ở danh sách. Từ BE PR #497 dòng của danh sách cũng kèm hợp đồng / đơn / đợt
 * (bo-24); BE cũ để null ngoài trang chi tiết.
 */
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
  status: receiptStatus,
  recordedBy: z.string().nullish(),
  recordedAt: z.string(),
  voidedBy: z.string().nullish(),
  voidedAt: z.string().nullish(),
  voidReason: z.string().nullish(),
  lines: z.array(receiptLineDtoSchema),
  /** R5-8 (BE round 5, có thể chưa có): tên người lập / người huỷ — không có thì không hiện dòng đó. */
  recordedByName: z.string().nullish(),
  voidedByName: z.string().nullish(),
  /**
   * WF-05 Q-20 (BE G2 `PaymentReceiptService.voidRefusal`): huỷ phiếu bây giờ có được nhận không — cùng luật lệnh
   * `/void` kiểm. Có ở CHI TIẾT và ở câu trả lời của lập / huỷ phiếu; null ở danh sách (BE không tính từng dòng).
   * `voidBlockedBy` = mã lỗi lệnh huỷ sẽ trả (PAYMENT_RECEIPT_ALREADY_VOIDED / _VOID_NOT_ALLOWED / _VOID_AFTER_HANDOVER;
   * mã lạ giữ nguyên chuỗi). Phiếu làm đơn thiếu đợt khi ký vẫn `voidable` — lệnh huỷ hỏi "Treo đơn" (409 _NEEDS_HOLD).
   */
  voidable: z.boolean().nullish(),
  voidBlockedBy: z.string().nullish(),
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
  /** #286: tên + mã khách kèm id; BE bỏ khi null → đọc kèm fallback. */
  customerName: z.string().nullish(),
  customerCode: z.string().nullish(),
  amount: z.number(),
  currency: z.string(),
  refundedOn: z.string(),
  reference: z.string(),
  note: z.string().nullish(),
  status: receiptStatus,
  recordedBy: z.string().nullish(),
  recordedAt: z.string(),
  voidedBy: z.string().nullish(),
  voidedAt: z.string().nullish(),
  voidReason: z.string().nullish(),
  /** #286: tên người ghi nhận / người huỷ — vắng thì không hiện. */
  recordedByName: z.string().nullish(),
  voidedByName: z.string().nullish(),
});

const settlementDtoSchema = z.object({
  settlementId: z.string(),
  kind: tolerantEnum(SETTLEMENT_KINDS),
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
  /** WF-05 Q-2 (BE G2): lô hãng hoàn về / thất lạc mà lần tính này đóng (`SHIPMENT_RETURNED`); null với loại khác. */
  shipmentId: z.string().nullish(),
  /**
   * WF-05 Q-19 (BE G2 follow-up): phần của `closed` là phí vận chuyển được miễn, đồng nguyên. SHIPMENT_RETURNED: phí theo
   * tỷ lệ giá trị hàng của lô trên giá trị hàng của đơn, hoặc toàn bộ phần còn lại khi đơn kết thúc không giao được gì;
   * REMAINDER_CLOSED: phần còn lại khi lần đóng đó kết thúc đơn mà không giao được gì; 0 / vắng với loại khác, BE cũ.
   */
  shippingFeeWaived: z.number().nullish(),
  /**
   * Audit r3 LM-3 (BE r3a `carriedToFee`): REMAINDER_CLOSED — phần các đợt trả trước khi giao của lô bị đóng cả lô còn phải
   * trả trên giá trị hàng đã đóng (phần phí khuôn, phí vận chuyển), chuyển sang khoản phí `feeItemId`, đến hạn từ ngày đóng.
   * Nằm trong `reduced`, phải trả cạnh `feeOwed`. 0 / vắng với loại khác, BE cũ.
   */
  carriedToFee: z.number().nullish(),
});

/** BE `OrderRefundResponse`; `settlements` / `records` vắng ở danh sách. */
export const orderRefundDtoSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  currency: z.string(),
  refundStatus: tolerantEnum(REFUND_API_STATUSES),
  refundable: z.number(),
  refunded: z.number(),
  remaining: z.number(),
  /**
   * WF-05 BE-51 (F-9): phí của đơn khách còn nợ (các khoản phí chưa trả) — hiện cạnh số còn phải hoàn để Kế toán không
   * chuyển hoàn khi khách vẫn còn nợ phí. Vắng = BE cũ.
   */
  feeOwed: z.number().nullish(),
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
  /**
   * Installments due on signing past their due day, still owed: not receivable (15 §4.3), so in no other figure here,
   * but the credit check of a new contract counts them as overdue — the BE ranks rows by `overdue + signingOverdue`.
   */
  signingOverdue: z.number().nullish(),
  oldestDueDate: z.string().nullish(),
  openItems: z.number().int().nullish(),
  /** `receivable + committedNotReached`: what the credit check of a new contract counts (15 BR-10). */
  exposure: z.number().nullish(),
  /** Null for a customer without approved credit. */
  creditLimit: z.number().nullish(),
  currency: z.string().nullish(),
});
/** Column sums of one currency over EVERY row the filter keeps, not only this page. */
export const receivableTotalsDtoSchema = z.object({
  currency: z.string(),
  customers: z.number().int(),
  receivable: z.number(),
  overdue1To30: z.number().nullish(),
  overdue31To60: z.number().nullish(),
  overdue61To90: z.number().nullish(),
  overdueOver90: z.number().nullish(),
  overdue: z.number(),
  signingOverdue: z.number().nullish(),
});
export const receivableReportDtoSchema = z.object({
  asOf: z.string().nullish(),
  rows: bePageSchema(receivableReportRowDtoSchema),
  totals: z.array(receivableTotalsDtoSchema).nullish(),
});

/** The screen's model of a receivable row (what `ReceivablesList` renders). */
export const receivableDtoSchema = z.object({
  customerId: z.string(),
  customerName: z.string().nullish(),
  customerCode: z.string().nullish(),
  taxCode: z.string().nullish(),
  owed: z.number(),
  overdue: z.number(),
  /** Overdue on-signing installments (counted in no other column); 0 when the BE leaves it out. */
  signingOverdue: z.number(),
  oldestDueOn: z.string().nullish(),
  aging: z.object({ d0to30: z.number(), d31to60: z.number(), over60: z.number() }).nullish(),
  installmentCount: z.number().int().nullish(),
  currency: z.string().default("VND"),
  /** Hạn mức đã duyệt; null = khách chưa được cấp hạn mức tín dụng. */
  creditLimit: z.number().nullish(),
  /** Dư nợ tính hạn mức (còn phải thu + phần sau giao của hàng chưa giao, 15 BR-10). */
  exposure: z.number().nullish(),
});
export const receivablePageDtoSchema = bePageSchema(receivableDtoSchema);

/** Tổng các cột trên MỌI khách khớp bộ lọc (không chỉ trang đang xem), một dòng mỗi tiền tệ. */
export const receivableTotalsSchema = z.object({
  currency: z.string(),
  customers: z.number().int(),
  owed: z.number(),
  overdue: z.number(),
  signingOverdue: z.number(),
  aging: z.object({ d0to30: z.number(), d31to60: z.number(), over60: z.number() }),
});
