/**
 * Order — Input schemas của duyệt / từ chối công nợ và huỷ đơn (body form gửi đi), tách khỏi DTO
 * (api-conventions §3.1). Giữ / gỡ giữ / giao thất bại / đóng phần còn lại: `input-schemas.ts`;
 * release (PR #74): `release-schemas.ts`.
 *
 * Mỗi schema khớp đúng request record của BE develop; BR cite theo docs + mã BE.
 */

import { z } from "zod";

import { ORDER_LIMITS } from "@/constants/numbers";
import { CREDIT_REJECTION_ACTIONS, ORDER_CANCELLATION_REASON_CODES } from "@/constants/orders";

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

export type CreditApprovalInput = z.infer<typeof creditApprovalSchema>;
export type CreditRejectionFormInput = z.input<typeof creditRejectionSchema>;
export type CreditRejectionInput = z.output<typeof creditRejectionSchema>;
export type AdminCancelOrderInput = z.infer<typeof adminCancelOrderSchema>;
