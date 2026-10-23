/**
 * Order — Input schemas (body form gửi đi), tách khỏi DTO (api-conventions §3.1).
 *
 * Mỗi schema khớp đúng request record của BE develop; BR cite theo docs + mã BE.
 */

import { z } from "zod";

import {
  ORDER_DELIVERY_FAILURE_REASONS,
  ORDER_MANUAL_HOLD_REASONS,
  ORDER_REMAINDER_CLOSURE_REASONS,
} from "@/constants/labels-order";
import { ORDER_LIMITS } from "@/constants/numbers";
import { CREDIT_REJECTION_ACTIONS, ORDER_CANCELLATION_REASON_CODES } from "@/constants/orders";

/* ── Release (SCRUM-423) ─────────────────────────────────────────────── */

/**
 * BE `ReleaseOrderRequest(@NotNull UUID warehouseId)`.
 * docs 17 §4.2 bước 4: Order Coordinator chọn kho xuất trước khi release.
 */
export const releaseOrderSchema = z.object({
  warehouseId: z.string().trim().min(1, "Chọn kho xuất"),
});

/* ── Credit hold (SCRUM-427) ─────────────────────────────────────────── */

const creditNote = z
  .string()
  .trim()
  // BE CreditDecisionRequest / CreditRefusalRequest: note @NotBlank — người duyệt phải ghi lý do
  .min(1, "Ghi chú là bắt buộc")
  .max(ORDER_LIMITS.creditNoteMax, `Ghi chú tối đa ${ORDER_LIMITS.creditNoteMax} ký tự`);

/** BE `CreditDecisionRequest(note)` — docs 14 BR-06: vượt hạn mức chỉ đi tiếp khi người có quyền duyệt. */
export const creditApprovalSchema = z.object({ note: creditNote });

/**
 * BE `CreditRefusalRequest(action, depositPercent?, note)`.
 * docs 15 §4.3 / docs 14 edge case "Đơn công nợ vượt hạn mức": từ chối → huỷ, hoặc khách chuyển
 * sang trả trước / đặt cọc.
 */
export const creditRejectionSchema = z
  .object({
    action: z.enum(CREDIT_REJECTION_ACTIONS, { error: "Chọn cách xử lý" }),
    depositPercent: z.number().optional(),
    note: creditNote,
  })
  .superRefine((value, ctx) => {
    if (value.action !== "SWITCH_TO_DEPOSIT") return;
    const pct = value.depositPercent;
    // BE CreditRefusalRequest: depositPercent 0 < x < 100 (biên mở) khi chuyển sang đặt cọc;
    // bỏ trống → BE dùng % cọc mặc định của hồ sơ công nợ khách.
    if (pct === undefined) return;
    if (!(pct > ORDER_LIMITS.depositPercentMin && pct < ORDER_LIMITS.depositPercentMax)) {
      ctx.addIssue({
        code: "custom",
        path: ["depositPercent"],
        message: `Tỷ lệ cọc phải lớn hơn ${ORDER_LIMITS.depositPercentMin}% và nhỏ hơn ${ORDER_LIMITS.depositPercentMax}%`,
      });
    }
  })
  // Chỉ gửi depositPercent khi chuyển sang đặt cọc
  .transform((value) =>
    value.action === "SWITCH_TO_DEPOSIT" ? value : { action: value.action, note: value.note },
  );

/* ── Admin cancel ────────────────────────────────────────────────────── */

/**
 * BE `CancellationFeeRequest(amount, reason, detail)` — khoản thoả thuận với khách thay cho phần
 * trăm (decision Q2): amount > 0 (BE còn kiểm số nguyên đơn vị tiền và ≤ tổng đơn → 400).
 */
const agreedFeeSchema = z.object({
  amount: z.number().positive("Khoản thoả thuận phải lớn hơn 0"),
  reason: z
    .string()
    .trim()
    .min(1, "Nhập lý do giữ khoản thoả thuận")
    .max(ORDER_LIMITS.cancelFeeReasonMax, `Lý do tối đa ${ORDER_LIMITS.cancelFeeReasonMax} ký tự`),
  detail: z
    .string()
    .trim()
    .min(1, "Nhập nội dung đã thoả thuận")
    .max(
      ORDER_LIMITS.cancelFeeDetailMax,
      `Nội dung tối đa ${ORDER_LIMITS.cancelFeeDetailMax} ký tự`,
    ),
});

/**
 * BE `AdminCancelOrderRequest(reasonCode, note, retainedPercent, agreedFee)` — `reason` (chữ tự do)
 * đã deprecated, FE không gửi. docs 17 §4.5 bước 14: nguồn huỷ (khách yêu cầu, hết hạn thanh toán,
 * hết hàng, nghi gian lận…). Response: `OrderResponse`.
 */
export const adminCancelOrderSchema = z
  .object({
    reasonCode: z.enum(ORDER_CANCELLATION_REASON_CODES, { error: "Chọn lý do huỷ" }),
    note: z
      .string()
      .trim()
      .max(ORDER_LIMITS.cancelNoteMax, `Ghi chú tối đa ${ORDER_LIMITS.cancelNoteMax} ký tự`)
      .optional(),
    retainedPercent: z
      .number()
      .min(ORDER_LIMITS.retainedPercentMin, "Tỷ lệ giữ lại không được âm")
      .max(ORDER_LIMITS.retainedPercentMax, "Tỷ lệ giữ lại tối đa 100%")
      .optional(),
    agreedFee: agreedFeeSchema.optional(),
  })
  .superRefine((value, ctx) => {
    // BE Order#cancel: reasonCode OTHER bắt buộc có note (VALIDATION_FAILED)
    if (value.reasonCode === "OTHER" && !value.note) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "Lý do khác cần ghi chú" });
    }
    // BE Order#requireAgreedFee: giữ phần trăm HOẶC khoản thoả thuận, không cả hai
    if (value.agreedFee && value.retainedPercent !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["agreedFee"],
        message: "Chỉ giữ theo phần trăm hoặc khoản thoả thuận, không cả hai",
      });
    }
  });

/* ── Giữ / gỡ giữ / giao thất bại / đóng phần còn lại (BE PR #133) ───── */

const NOTE_REQUIRED = "Ghi chú là bắt buộc khi chọn “Lý do khác”";

/**
 * Lý do + ghi chú: BE `Order#putOnHold`, `#markDeliveryFailed`, `#closeRemainder` — OTHER bắt buộc
 * có ghi chú (400 VALIDATION_FAILED nếu thiếu). `note` được trim; rỗng → bỏ khỏi body (api.ts).
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
 * DESIGN_MISMATCH là của hệ thống (`HoldReason#raisedByHand`), BE trả 400.
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
 * Đóng phần còn lại (`POST /orders/{id}/remainder-closure`, `CloseRemainderRequest`). BE nhận mọi
 * `CancellationReasonCode`; danh sách chọn chỉ giữ lý do hợp với việc không giao nổi phần còn lại.
 */
export const remainderClosureSchema = reasonWithNote(
  ORDER_REMAINDER_CLOSURE_REASONS,
  ORDER_LIMITS.remainderClosureNoteMax,
  "Ghi chú",
);

export type ReleaseOrderInput = z.infer<typeof releaseOrderSchema>;
export type CreditApprovalInput = z.infer<typeof creditApprovalSchema>;
export type CreditRejectionFormInput = z.input<typeof creditRejectionSchema>;
export type CreditRejectionInput = z.output<typeof creditRejectionSchema>;
export type AdminCancelOrderInput = z.infer<typeof adminCancelOrderSchema>;
export type HoldOrderValues = z.infer<typeof holdOrderSchema>;
export type ResolveOrderHoldValues = z.infer<typeof resolveOrderHoldSchema>;
export type DeliveryFailureValues = z.infer<typeof deliveryFailureSchema>;
export type RemainderClosureValues = z.infer<typeof remainderClosureSchema>;
