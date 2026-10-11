/**
 * Order — Input schemas (body form gửi đi), tách khỏi DTO (api-conventions §3.1).
 *
 * Mỗi schema khớp đúng request record của BE develop; BR cite theo docs + mã BE.
 */

import { z } from "zod";

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
 * BE `AdminCancelOrderRequest(reasonCode, note, retainedPercent)` — `reason` cũ đã deprecated.
 * docs 17 §4.5 bước 14: nguồn huỷ (khách yêu cầu, hết hạn thanh toán, hết hàng, nghi gian lận…).
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
  })
  .superRefine((value, ctx) => {
    // BE Order#cancelByAdmin: reasonCode OTHER bắt buộc có note (VALIDATION_FAILED)
    if (value.reasonCode === "OTHER" && !value.note) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "Lý do khác cần ghi chú" });
    }
  });

export type ReleaseOrderInput = z.infer<typeof releaseOrderSchema>;
export type CreditApprovalInput = z.infer<typeof creditApprovalSchema>;
export type CreditRejectionFormInput = z.input<typeof creditRejectionSchema>;
export type CreditRejectionInput = z.output<typeof creditRejectionSchema>;
export type AdminCancelOrderInput = z.infer<typeof adminCancelOrderSchema>;
