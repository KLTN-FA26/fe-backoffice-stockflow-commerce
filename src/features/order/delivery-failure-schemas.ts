/**
 * Giao thất bại (WF-05 GH-1; docs 09 §4.3, 17 §4.8) — DTO + input của BE `DeliveryFailureController`.
 *
 * DTO `DeliveryFailureCaseResponse`: field null bị BỎ khỏi JSON (Jackson non_null) → `.nullish()` rồi chuẩn hoá null.
 * Input `DeliveryFailureCaseRequests.Redelivery {note, failedTripFee?}` / `.Cancellation {note, agreedFee?}`.
 */

import { z } from "zod";

import {
  DELIVERY_FAILURE_CASE_STATUSES,
  DELIVERY_FAILURE_CUSTOMER_PAID_REASONS,
  DELIVERY_FAILURE_LABELS,
  DELIVERY_FAILURE_LIMITS,
} from "@/constants/labels-order-delivery-failure";
import { ORDER_DELIVERY_FAILURE_REASONS } from "@/constants/labels-order";
import { ORDER_STATUS_UNKNOWN } from "@/constants/statuses";

const V = DELIVERY_FAILURE_LABELS.validation;

/** Giá trị lạ (BE thêm sau) → "UNKNOWN": hiển thị "Không rõ", không mở thao tác nào. */
const caseStatus = z
  .enum([...DELIVERY_FAILURE_CASE_STATUSES, ORDER_STATUS_UNKNOWN])
  .catch(ORDER_STATUS_UNKNOWN);
const failureReason = z
  .enum([...ORDER_DELIVERY_FAILURE_REASONS, ORDER_STATUS_UNKNOWN])
  .catch(ORDER_STATUS_UNKNOWN);

/** BE `DeliveryFailureCaseResponse` → model FE (field vắng → null, danh sách vắng → rỗng). */
export const deliveryFailureCaseSchema = z
  .object({
    caseId: z.string(),
    orderId: z.string(),
    orderNumber: z.string(),
    customerId: z.string().nullish(),
    /** ON_HOLD khi còn hồ sơ chờ Sale; PARTIALLY_FULFILLED khi hàng sắp giao lại. Chỉ hiển thị. */
    orderStatus: z.string().nullish(),
    shipmentId: z.string(),
    deliveryBatchId: z.string().nullish(),
    receiptId: z.string().nullish(),
    receiptNumber: z.string().nullish(),
    warehouseId: z.string().nullish(),
    failureReason,
    failureNote: z.string().nullish(),
    /** REFUSED / WRONG_ADDRESS: giao lại phải tính phí chuyến hỏng cho khách. */
    customerPaysFailedTrip: z.boolean(),
    status: caseStatus,
    openedAt: z.string(),
    decidedBy: z.string().nullish(),
    decidedAt: z.string().nullish(),
    decisionNote: z.string().nullish(),
    failedTripFee: z.number().nullish(),
    feeInstallmentId: z.string().nullish(),
    carrierClaim: z.boolean().nullish(),
    readyForRelease: z.boolean().nullish(),
    releasedAt: z.string().nullish(),
    redeliveryShipmentId: z.string().nullish(),
    redeliveredAt: z.string().nullish(),
    closedAt: z.string().nullish(),
    lines: z
      .array(z.object({ orderLineId: z.string(), units: z.number(), heldUnits: z.number() }))
      .nullish(),
    cartons: z
      .array(
        z.object({
          lpn: z.string(),
          sku: z.string(),
          lotNumber: z.string().nullish(),
          quantity: z.number(),
          condition: z.string().nullish(),
        }),
      )
      .nullish(),
    version: z.number().nullish(),
  })
  .transform((dto) => ({
    ...dto,
    customerId: dto.customerId ?? null,
    receiptNumber: dto.receiptNumber ?? null,
    failureNote: dto.failureNote ?? null,
    decidedAt: dto.decidedAt ?? null,
    decisionNote: dto.decisionNote ?? null,
    failedTripFee: dto.failedTripFee ?? null,
    carrierClaim: dto.carrierClaim ?? false,
    readyForRelease: dto.readyForRelease ?? false,
    lines: dto.lines ?? [],
    cartons: dto.cartons ?? [],
  }));

export const deliveryFailureCaseListSchema = z.array(deliveryFailureCaseSchema);

export type DeliveryFailureCase = z.output<typeof deliveryFailureCaseSchema>;
export type DeliveryFailureCaseStatus = DeliveryFailureCase["status"];

/* ── Input ───────────────────────────────────────────────────────────── */

const note = z
  .string()
  .trim()
  .min(1, V.noteRequired)
  .max(DELIVERY_FAILURE_LIMITS.noteMax, V.noteTooLong);

/** Ô tiền dạng chữ → số nguyên VND > 0 (BE `@DecimalMin(0, exclusive) @Digits(fraction = 0)`). */
const wholeVnd = (message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, message)
    .transform(Number)
    .refine((value) => value > 0, message);

/** Lý do khách gây ra chuyến hỏng (BE `customerPaysFailedTrip`). */
export function customerPaysFailedTrip(reason: DeliveryFailureCase["failureReason"]): boolean {
  return (DELIVERY_FAILURE_CUSTOMER_PAID_REASONS as readonly string[]).includes(reason);
}

/**
 * Giao lại (BE `Redelivery`). docs 09 §4.3 + BE `DeliveryFailureCase#requireRedeliverable`: phí chuyến hỏng BẮT BUỘC khi
 * khách gây ra (REFUSED / WRONG_ADDRESS) và PHẢI BỎ với lý do khác (chi phí đòi hãng vận chuyển).
 */
export function redeliveryInputSchema(customerPays: boolean) {
  return z.object({ note, failedTripFee: z.string() }).transform((value, ctx) => {
    if (!customerPays) return { note: value.note, failedTripFee: undefined };
    const fee = wholeVnd(V.feeInvalid).safeParse(value.failedTripFee);
    if (!fee.success) {
      ctx.addIssue({ code: "custom", path: ["failedTripFee"], message: V.feeRequired });
      return z.NEVER;
    }
    return { note: value.note, failedTripFee: fee.data };
  });
}

export type RedeliveryFormValues = z.input<ReturnType<typeof redeliveryInputSchema>>;
export type RedeliveryValues = z.output<ReturnType<typeof redeliveryInputSchema>>;

/**
 * Huỷ phần chưa giao (BE `Cancellation` + `CancellationFeeRequest`): ghi chú bắt buộc; phí thoả thuận tuỳ chọn — khi
 * giữ phí thì cần đủ số tiền (> 0, nguyên), lý do (≤ 500) và nội dung (≤ 2000). Trần "không vượt giá trị hàng đã làm"
 * do BE kiểm (FE không có giá trị đó).
 */
export const cancelUndeliveredInputSchema = z
  .object({
    note,
    withFee: z.boolean(),
    feeAmount: z.string(),
    feeReason: z.string(),
    feeDetail: z.string(),
  })
  .transform((value, ctx) => {
    if (!value.withFee) return { note: value.note, agreedFee: undefined };
    const amount = wholeVnd(V.feeInvalid).safeParse(value.feeAmount);
    const reason = value.feeReason.trim();
    const detail = value.feeDetail.trim();
    if (!amount.success) {
      ctx.addIssue({ code: "custom", path: ["feeAmount"], message: V.feeInvalid });
    }
    if (reason === "" || reason.length > DELIVERY_FAILURE_LIMITS.feeReasonMax) {
      ctx.addIssue({ code: "custom", path: ["feeReason"], message: V.feeReasonRequired });
    }
    if (detail === "" || detail.length > DELIVERY_FAILURE_LIMITS.feeDetailMax) {
      ctx.addIssue({ code: "custom", path: ["feeDetail"], message: V.feeDetailRequired });
    }
    if (!amount.success) return z.NEVER;
    return { note: value.note, agreedFee: { amount: amount.data, reason, detail } };
  });

export type CancelUndeliveredFormValues = z.input<typeof cancelUndeliveredInputSchema>;
export type CancelUndeliveredValues = z.output<typeof cancelUndeliveredInputSchema>;

export const CANCEL_UNDELIVERED_DEFAULTS: CancelUndeliveredFormValues = {
  note: "",
  withFee: false,
  feeAmount: "",
  feeReason: "",
  feeDetail: "",
};
