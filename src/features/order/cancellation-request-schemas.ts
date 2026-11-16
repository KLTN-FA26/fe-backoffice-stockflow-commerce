/**
 * Yêu cầu huỷ của khách (docs 17 §4.8 bước 28, §5.4) — DTO BE `CancellationRequestResponse` + input duyệt / từ chối.
 * Hai lớp tách bạch (api-conventions §3.1): DTO là hình dạng BE trả về, Input là dữ liệu form gửi đi kèm BR.
 *
 * BE `CancellationRequestStatus`: PENDING → APPROVED | REJECTED | EXPIRED. Trạng thái lạ KHÔNG đoán: giữ nguyên chuỗi,
 * chỉ `PENDING` mới mở nút quyết định.
 */

import { z } from "zod";

import {
  CANCELLATION_REQUEST_LABELS as L,
  CANCELLATION_REQUEST_STATUS_DISPLAY,
} from "@/constants/labels-order-cancellation-request";
import { ORDER_LIMITS } from "@/constants/numbers";
import { bePageSchema } from "@/lib/api/page-schema";

import { agreedFeeSchema } from "./input-schemas";

/* ── DTO ─────────────────────────────────────────────────────────────── */

/** Jackson `non_null`: field null bị bỏ → `.nullish()`. */
export const cancellationRequestDtoSchema = z.object({
  requestId: z.string(),
  orderId: z.string(),
  requestedBy: z.string().nullish(),
  /** BE `CancellationReasonCode` — khách chỉ chọn CUSTOMER_REQUEST / DUPLICATE_ORDER / OTHER (docs 17 §4.8 bước 29). */
  reasonCode: z.string(),
  note: z.string().nullish(),
  requestedAt: z.string(),
  status: z.string(),
  decidedBy: z.string().nullish(),
  decidedAt: z.string().nullish(),
  decisionNote: z.string().nullish(),
  /** Phần trăm tiền đã thu giữ lại khi duyệt (BigDecimal → số). */
  retainedPercent: z.number().nullish(),
  version: z.number().int().nullish(),
});

export const cancellationRequestPageDtoSchema = bePageSchema(cancellationRequestDtoSchema);

/* ── Model FE ────────────────────────────────────────────────────────── */

export const cancellationRequestSchema = z.object({
  requestId: z.string(),
  orderId: z.string(),
  reasonCode: z.string(),
  note: z.string().nullable(),
  requestedAt: z.string(),
  /** Mã BE nguyên văn (PENDING…) — gate nút theo đây. */
  status: z.string(),
  decidedAt: z.string().nullable(),
  decisionNote: z.string().nullable(),
  retainedPercent: z.number().nullable(),
});

export type CancellationRequestDto = z.infer<typeof cancellationRequestDtoSchema>;
export type CancellationRequest = z.infer<typeof cancellationRequestSchema>;

/**
 * Trạng thái hiển thị theo docs 17 §5.4 (`Pending`…); mã BE lạ → trả nguyên chuỗi (không đoán, không báo là "đã xong").
 */
export function cancellationRequestDisplayStatus(status: string): string {
  return Object.hasOwn(CANCELLATION_REQUEST_STATUS_DISPLAY, status)
    ? CANCELLATION_REQUEST_STATUS_DISPLAY[
        status as keyof typeof CANCELLATION_REQUEST_STATUS_DISPLAY
      ]
    : status;
}

/* ── Input ───────────────────────────────────────────────────────────── */

/** `ApproveCancellationRequest.retainedPercent`: BigDecimal 0–100, tối đa 2 chữ số thập phân (BE `Order#cancel`). */
const retainedPercentSchema = z
  .number({ error: L.fee.percentInvalid })
  .gt(0, L.fee.percentInvalid)
  .max(100, L.fee.percentInvalid)
  .refine((value) => Math.round(value * 100) / 100 === value, L.fee.percentInvalid);

/**
 * Duyệt yêu cầu huỷ (`POST /orders/{id}/cancellation-requests/{requestId}/approval`, `ApproveCancellationRequest`):
 * ghi chú tuỳ chọn ≤ 1000; phí giữ lại là TUỲ CHỌN và chỉ một trong hai (docs 17 §4.8 bước 30: "% số tiền đã thu, hoặc
 * số tiền thoả thuận"). BE từ chối phí khi chưa in hàng loạt (CANCELLATION_FEE_BEFORE_PRINTING) — FE không biết mốc
 * này (`OrderResponse` không trả `printingStartedAt`) nên để BE quyết.
 */
export const approveCancellationSchema = z
  .object({
    note: z
      .string()
      .trim()
      .max(
        ORDER_LIMITS.cancellationDecisionNoteMax,
        `Ghi chú tối đa ${ORDER_LIMITS.cancellationDecisionNoteMax} ký tự`,
      ),
    retainedPercent: retainedPercentSchema.optional(),
    agreedFee: agreedFeeSchema.optional(),
  })
  // docs 17 §4.8 bước 30 / BE `Order#requireAgreedFee`: "Keep a percentage or an agreed amount, not both"
  .refine((value) => !(value.retainedPercent !== undefined && value.agreedFee !== undefined), {
    path: ["agreedFee"],
    message: L.fee.bothChosen,
  });

/** Từ chối (`.../rejection`, `RejectCancellationRequest`): ghi lý do BẮT BUỘC (docs 17 §4.8 bước 28) ≤ 1000. */
export const rejectCancellationSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, L.reject.noteRequired)
    .max(
      ORDER_LIMITS.cancellationDecisionNoteMax,
      `Lý do tối đa ${ORDER_LIMITS.cancellationDecisionNoteMax} ký tự`,
    ),
});

export type ApproveCancellationValues = z.infer<typeof approveCancellationSchema>;
export type RejectCancellationValues = z.infer<typeof rejectCancellationSchema>;

/* ── Tất toán sau huỷ (BE `OrderRefundResponse`, docs 15 §4.5–4.6) ───── */

const settlementSchema = z.object({
  settlementId: z.string(),
  kind: z.string(),
  collected: z.number(),
  fee: z.number().nullish(),
  feePercent: z.number().nullish(),
  feeReason: z.string().nullish(),
  feeDetail: z.string().nullish(),
  feeCovered: z.number().nullish(),
  refundable: z.number().nullish(),
  feeOwed: z.number().nullish(),
  settledAt: z.string().nullish(),
});

export const orderRefundDtoSchema = z.object({
  orderId: z.string(),
  currency: z.string(),
  refundStatus: z.string(),
  settlements: z.array(settlementSchema).nullish(),
});

export type OrderRefundDto = z.infer<typeof orderRefundDtoSchema>;
export type OrderSettlement = z.infer<typeof settlementSchema>;
