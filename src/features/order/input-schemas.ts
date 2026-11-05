/**
 * Order — input form gửi đi (giữ, gỡ giữ, giao thất bại, đóng phần còn lại, giao một phần, hình thức giao).
 * DTO BE ở `schemas.ts`. Huỷ + duyệt / từ chối công nợ: `action-schemas.ts`; release: `release-schemas.ts`.
 */

import { z } from "zod";

import { ORDER_DELIVERY_MODES } from "@/constants/labels-delivery-mode";
import {
  ORDER_DELIVERY_FAILURE_REASONS,
  ORDER_MANUAL_HOLD_REASONS,
  ORDER_REMAINDER_CLOSURE_REASONS,
  ORDER_REMAINDER_FEE_LABELS,
} from "@/constants/labels-order";
import { ORDER_LIMITS } from "@/constants/numbers";

/* ── Hold / resolve / delivery-failure / remainder-closure input ─────── */

const NOTE_REQUIRED = "Ghi chú là bắt buộc khi chọn “Lý do khác”";

/**
 * Lý do + ghi chú: BE `Order#putOnHold`, `#markDeliveryFailed`, `#closeRemainder` — OTHER bắt buộc
 * có ghi chú (400 VALIDATION_FAILED nếu thiếu). `note` được trim; rỗng → bỏ khỏi body.
 */
function reasonWithNote<const R extends readonly [string, ...string[]]>(
  reasons: R,
  noteMax: number,
  noteLabel: string,
) {
  return z
    .object({
      reasonCode: z.enum(reasons, { error: "Chọn lý do" }),
      note: z.string().trim().max(noteMax, `${noteLabel} tối đa ${noteMax} ký tự`),
    })
    .refine((value) => value.reasonCode !== "OTHER" || value.note.length > 0, {
      path: ["note"],
      message: NOTE_REQUIRED,
    });
}

/**
 * Giữ đơn (`POST /orders/{id}/hold`, `HoldOrderRequest`). Chỉ lý do tự nêu — CREDIT và
 * DESIGN_MISMATCH là của hệ thống, BE trả 400.
 */
export const holdOrderSchema = reasonWithNote(
  ORDER_MANUAL_HOLD_REASONS,
  ORDER_LIMITS.holdNoteMax,
  "Ghi chú",
);

/** Gỡ giữ (`POST /orders/{id}/hold/resolution`, `ResolveHoldRequest`): ghi chú @NotBlank. */
export const resolveOrderHoldSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, "Hãy ghi cách đã xử lý")
    .max(ORDER_LIMITS.resolveNoteMax, `Ghi chú tối đa ${ORDER_LIMITS.resolveNoteMax} ký tự`),
});

/** Ghi giao thất bại (`POST /orders/{id}/delivery-failure`, `DeliveryFailureRequest`). */
export const deliveryFailureSchema = reasonWithNote(
  ORDER_DELIVERY_FAILURE_REASONS,
  ORDER_LIMITS.deliveryFailureNoteMax,
  "Ghi chú",
);

/**
 * Khoản phí đã thoả thuận khi đóng phần còn lại (`CloseRemainderRequest.agreedFee` = `CancellationFeeRequest`,
 * BE PR #150): số tiền nguyên VND > 0 (BE `Order#requireRemainderFee`: đúng số chữ số thập phân của tiền
 * tệ, VND = 0), lý do ≤ 500 và chi tiết ≤ 2000 đều bắt buộc. Trần = giá trị phần hàng in bị đóng, BE
 * mới biết (400) — FE không đoán.
 */
export const agreedFeeSchema = z.object({
  amount: z
    .number({ error: ORDER_REMAINDER_FEE_LABELS.amountInvalid })
    .int(ORDER_REMAINDER_FEE_LABELS.amountInvalid)
    .positive(ORDER_REMAINDER_FEE_LABELS.amountInvalid),
  reason: z
    .string()
    .trim()
    .min(1, ORDER_REMAINDER_FEE_LABELS.reasonRequired)
    .max(ORDER_LIMITS.feeReasonMax, ORDER_REMAINDER_FEE_LABELS.reasonTooLong),
  detail: z
    .string()
    .trim()
    .min(1, ORDER_REMAINDER_FEE_LABELS.detailRequired)
    .max(ORDER_LIMITS.feeDetailMax, ORDER_REMAINDER_FEE_LABELS.detailTooLong),
});

/** Đóng phần còn lại (`POST /orders/{id}/remainder-closure`, `CloseRemainderRequest`). */
export const remainderClosureSchema = z
  .object({
    reasonCode: z.enum(ORDER_REMAINDER_CLOSURE_REASONS, { error: "Chọn lý do" }),
    note: z
      .string()
      .trim()
      .max(
        ORDER_LIMITS.remainderClosureNoteMax,
        `Ghi chú tối đa ${ORDER_LIMITS.remainderClosureNoteMax} ký tự`,
      ),
    /** Tuỳ chọn; chỉ sau khi hàng in đã in (BE 409 CANCELLATION_FEE_BEFORE_PRINTING nếu chưa). */
    agreedFee: agreedFeeSchema.optional(),
  })
  .refine((value) => value.reasonCode !== "OTHER" || value.note.length > 0, {
    path: ["note"],
    message: NOTE_REQUIRED,
  });

/**
 * Cho phép / dừng giao một phần (`PUT /orders/{id}/partial-shipment`, `PartialShipmentRequest`):
 * `allowed` bắt buộc, `note` ≤ 500 không bắt buộc (được ghi vào lịch sử đơn).
 */
export const partialShipmentSchema = z.object({
  allowed: z.boolean(),
  note: z
    .string()
    .trim()
    .max(
      ORDER_LIMITS.partialShipmentNoteMax,
      `Ghi chú tối đa ${ORDER_LIMITS.partialShipmentNoteMax} ký tự`,
    ),
});

/**
 * Đổi hình thức giao (`PUT /orders/{id}/delivery-mode`, `DeliveryModeRequest`, BE PR #157, LP-1):
 * `deliveryMode` bắt buộc (PARCEL | FULL_TRUCKLOAD), `note` ≤ 500 không bắt buộc (vào lịch sử đơn).
 */
export const deliveryModeSchema = z.object({
  deliveryMode: z.enum(ORDER_DELIVERY_MODES, { error: "Chọn hình thức giao" }),
  note: z
    .string()
    .trim()
    .max(
      ORDER_LIMITS.deliveryModeNoteMax,
      `Ghi chú tối đa ${ORDER_LIMITS.deliveryModeNoteMax} ký tự`,
    ),
});

export type HoldOrderValues = z.infer<typeof holdOrderSchema>;
export type ResolveOrderHoldValues = z.infer<typeof resolveOrderHoldSchema>;
export type DeliveryFailureValues = z.infer<typeof deliveryFailureSchema>;
export type RemainderClosureValues = z.infer<typeof remainderClosureSchema>;
export type AgreedFeeValues = z.infer<typeof agreedFeeSchema>;
export type PartialShipmentValues = z.infer<typeof partialShipmentSchema>;
export type DeliveryModeValues = z.infer<typeof deliveryModeSchema>;
