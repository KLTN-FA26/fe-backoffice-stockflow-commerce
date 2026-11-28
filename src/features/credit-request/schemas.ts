/**
 * Đề nghị cấp hạn mức — DTO BE `CreditRequestResponse` (PR #490, `payment/internal/controller/dto`) và Input của form.
 * Jackson non_null → trường null bị bỏ → `.nullish()`. Trường nội bộ (`salesNote`, `review`, `*By`) BE chỉ trả cho back
 * office. Mọi lệnh ghi gửi `version` đang hiển thị (OPTIMISTIC_LOCK).
 */

import { z } from "zod";

import { CREDIT_REQUEST_API_STATUSES, CREDIT_REQUEST_LIMITS } from "@/constants/credit-request";

import { bePageSchema } from "@/lib/api/page-schema";

const status = z.union([
  z.enum(CREDIT_REQUEST_API_STATUSES),
  z.string().transform((): "UNKNOWN" => "UNKNOWN"),
]);

export const creditRequestFileSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  contentType: z.string().nullish(),
  sizeBytes: z.number(),
  uploadedBy: z.string().nullish(),
  uploadedAt: z.string(),
});

/** Số liệu để Kế toán xét (chỉ back office) — `warnings` chỉ cảnh báo, không chặn Duyệt. */
export const creditRequestReviewSchema = z.object({
  settledContracts: z.number().int(),
  paidInstallments: z.number().int(),
  onTimeInstallments: z.number().int(),
  /** 0–1; null khi chưa trả đợt nào. */
  onTimeRatio: z.number().nullish(),
  /** Null khi chưa trễ. */
  averageDaysLate: z.number().nullish(),
  paidLast12Months: z.number(),
  outstanding: z.number(),
  hasOverdue: z.boolean(),
  overdueAmount: z.number().nullish(),
  oldestOverdueDueDate: z.string().nullish(),
  currentCreditLimit: z.number().nullish(),
  currentCreditTermDays: z.number().int().nullish(),
  /** Gửi lại khi duyệt; −1 khi khách chưa có hạn mức. */
  creditTermsVersion: z.number().int(),
  suggestedLimit: z.number().nullish(),
  warnings: z.array(z.string()).default([]),
  minSettledContracts: z.number().int(),
  suggestedMonths: z.number().int(),
});

export const creditRequestDtoSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  customerName: z.string().nullish(),
  customerCode: z.string().nullish(),
  /** `PORTAL` | `SALES`. */
  source: z.string(),
  status,
  requestedLimit: z.number(),
  requestedTermDays: z.number().int(),
  currency: z.string().default("VND"),
  reason: z.string().nullish(),
  submittedBy: z.string().nullish(),
  submittedByName: z.string().nullish(),
  submittedAt: z.string(),
  salesNote: z.string().nullish(),
  salesRecommendedLimit: z.number().nullish(),
  recommendedBy: z.string().nullish(),
  recommendedByName: z.string().nullish(),
  recommendedAt: z.string().nullish(),
  approvedLimit: z.number().nullish(),
  approvedTermDays: z.number().int().nullish(),
  decidedBy: z.string().nullish(),
  decidedByName: z.string().nullish(),
  decidedAt: z.string().nullish(),
  /** Ghi chú của Kế toán; lý do khi từ chối (khách cũng thấy). */
  decisionNote: z.string().nullish(),
  version: z.number().int(),
  files: z.array(creditRequestFileSchema).nullish(),
  review: creditRequestReviewSchema.nullish(),
  /**
   * bo-28 (BE PR #497): hạn mức hiện tại của khách, cạnh hạn mức xin — trên dòng danh sách và chi tiết back office.
   * null = khách chưa có hạn mức; vắng = BE cũ (danh sách giữ cột "Hạn mức xin" như trước).
   */
  currentCreditLimit: z.number().nullish(),
});

export const creditRequestPageDtoSchema = bePageSchema(creditRequestDtoSchema);

export const downloadLinkSchema = z.object({ url: z.string(), expiresAt: z.string().nullish() });

/* ── Input ─────────────────────────────────────────────────────────────── */

const money = z.coerce.number({ message: "Nhập số tiền" }).int("Số tiền là số nguyên");
const text = z.string().trim().max(CREDIT_REQUEST_LIMITS.textMax, "Tối đa 1000 ký tự");
const termDays = z.coerce
  .number({ message: "Nhập số ngày" })
  .int("Số ngày là số nguyên")
  .min(0, "Từ 0 ngày")
  .max(CREDIT_REQUEST_LIMITS.termDaysMax, "Tối đa 365 ngày");
const optionalMoney = z
  .union([z.literal(""), money.positive("Lớn hơn 0")])
  .transform((value) => (value === "" ? undefined : value));

/** Sale tạo thay khách (BE `File`): `salesNote` bắt buộc ở back office. */
export const creditRequestCreateInput = z.object({
  customerId: z.string().min(1, "Chọn khách hàng"),
  requestedLimit: money.positive("Hạn mức xin phải lớn hơn 0"),
  requestedTermDays: termDays,
  reason: text.optional(),
  salesNote: text.min(1, "Ý kiến của Sale là bắt buộc"),
  recommendedLimit: optionalMoney,
});

/** Ý kiến của Sale cho đề nghị khách gửi (BE `Recommend`). */
export const creditRequestRecommendInput = z.object({
  note: text.min(1, "Nhập ý kiến"),
  recommendedLimit: optionalMoney,
});

/**
 * Duyệt (BE `Approve`): hạn mức > 0 và ≤ hạn mức khách xin (15 §4.3 bước 11a; BE CREDIT_REQUEST_ABOVE_REQUESTED) —
 * schema dựng theo `requestedLimit` của đề nghị đang xem.
 */
export function approveInputFor(requestedLimit: number) {
  return z.object({
    approvedLimit: money
      .positive("Hạn mức duyệt phải lớn hơn 0")
      .max(requestedLimit, "Không được cao hơn hạn mức khách xin"),
    approvedTermDays: termDays,
    note: text.optional(),
  });
}

export const creditRequestRejectInput = z.object({
  reason: text.min(1, "Nhập lý do từ chối"),
});
