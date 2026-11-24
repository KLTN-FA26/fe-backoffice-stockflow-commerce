/**
 * Lô hàng hoàn về (WF-05 GH-1; docs 09 §4.3, 17 §4.8) — DTO + input của BE `DeliveryFailureController`.
 *
 * DTO `DeliveryFailureCaseResponse`: field null bị BỎ khỏi JSON (Jackson non_null) → `.nullish()` rồi chuẩn hoá null.
 * Input `DeliveryFailureCaseRequests.Cancellation {note, agreedFee?}` (đơn cũ). Đóng phần thất lạc: `{note,
 * evidenceUploadId}` (Q-12, F-5).
 */

import { z } from "zod";

import {
  DELIVERY_FAILURE_CASE_STATUSES,
  DELIVERY_FAILURE_CLOSURES,
  DELIVERY_FAILURE_LABELS,
  DELIVERY_FAILURE_LIMITS,
  LOST_SHIPMENT_CLOSURE_LABELS,
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
/**
 * F-4: ai đóng hồ sơ CANCELLED — kho khi nhận hàng hoàn về (`RECORDED_ON_RETURN`, hệ thống) hay Sale huỷ phần chưa giao
 * (`CANCELLED_BY_SALES`). Vắng (BE cũ) hoặc giá trị lạ → null: nhãn trung tính "Đã đóng", không đoán.
 */
const closure = z.enum(DELIVERY_FAILURE_CLOSURES).nullish().catch(null);

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
    closure,
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
    orderStatus: dto.orderStatus ?? null,
    closure: dto.closure ?? null,
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

/* ── Đóng phần thất lạc (Q-12, F-5) ────────────────────────────────── */

const LOST = LOST_SHIPMENT_CLOSURE_LABELS;

/**
 * Đóng phần thất lạc: ghi chú 1..1000 (BE F-5) + tệp xác nhận thất lạc của hãng BẮT BUỘC (PR-0
 * `ORDER_SHIPMENT_LOSS_EVIDENCE_REQUIRED`). `evidenceUploadId` do `useEvidenceUpload` điền khi tệp đã tải xong; "" = chưa có.
 */
export const lostClosureInputSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, LOST.noteRequired)
    .max(DELIVERY_FAILURE_LIMITS.noteMax, LOST.noteTooLong),
  evidenceUploadId: z.string().min(1, LOST.evidenceRequired),
});

export type LostClosureFormValues = z.input<typeof lostClosureInputSchema>;
export type LostClosureValues = z.output<typeof lostClosureInputSchema>;

export const LOST_CLOSURE_DEFAULTS: LostClosureFormValues = { note: "", evidenceUploadId: "" };
