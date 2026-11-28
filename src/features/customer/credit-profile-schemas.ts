/**
 * Hạn mức công nợ của khách — form cấp / sửa (AUTH-6). Luật chép từ BE `CreditProfile#apply` và
 * `SaveCreditProfileRequest` (docs 18 §3, 15 BR-12): hạn mức và số ngày cùng có hoặc cùng trống (không cho công nợ),
 * hạn mức ≥ 0, số ngày 0–365, ghi chú ≤ 1000 ký tự. Lỗi BE (400 `CREDIT_PROFILE_INVALID`) không kèm `fieldErrors`,
 * nên FE kiểm trước tại ô.
 */

import { z } from "zod";

/** BE `credit_profile.credit_limit numeric(19,4)`; `MoneyInput` giữ tối đa 15 chữ số (đúng tuyệt đối trong JS). */
const CREDIT_LIMIT_DIGITS = /^\d{1,15}$/;
const CREDIT_TERM_DAYS = /^\d{1,3}$/;
export const CREDIT_TERM_DAYS_MAX = 365;
export const CREDIT_NOTE_MAX = 1000;
const BOTH_OR_NEITHER = "Nhập cả hạn mức và số ngày, hoặc để trống cả hai (không cho công nợ)";

export const creditProfileInputSchema = z
  .object({
    /** Chữ số thuần từ `MoneyInput` ("" = trống). */
    creditLimit: z.string().trim(),
    creditTermDays: z.string().trim(),
    note: z.string().trim().max(CREDIT_NOTE_MAX, `Tối đa ${CREDIT_NOTE_MAX} ký tự`),
  })
  .superRefine((v, ctx) => {
    if (v.creditLimit !== "" && !CREDIT_LIMIT_DIGITS.test(v.creditLimit)) {
      ctx.addIssue({ code: "custom", path: ["creditLimit"], message: "Hạn mức không hợp lệ" });
    }
    if (
      v.creditTermDays !== "" &&
      !(CREDIT_TERM_DAYS.test(v.creditTermDays) && Number(v.creditTermDays) <= CREDIT_TERM_DAYS_MAX)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["creditTermDays"],
        message: `Số ngày là số nguyên từ 0 đến ${CREDIT_TERM_DAYS_MAX}`,
      });
    }
    // BE CreditProfile#apply: "A credit limit and the days to pay are given together, or neither".
    if ((v.creditLimit === "") !== (v.creditTermDays === "")) {
      const missing = v.creditLimit === "" ? "creditLimit" : "creditTermDays";
      ctx.addIssue({ code: "custom", path: [missing], message: BOTH_OR_NEITHER });
    }
  });

/**
 * BE `CreditPositionResponse` — `GET /orders/credit-position/{customerId}` (`customer-credit-profiles:READ`, cùng quyền
 * đọc hạn mức): dư nợ phần trả sau giao, phần còn dùng được và khoản quá hạn HIỆN TẠI (15 BR-10). Jackson non_null:
 * `creditLimit`, `creditTermDays`, `availableCredit` vắng khi khách không được bán trả sau; `oldestOverdueDueDate` vắng
 * khi không có quá hạn.
 */
export const creditPositionDtoSchema = z.object({
  customerId: z.string(),
  creditLimit: z.number().nullish(),
  creditTermDays: z.number().int().nullish(),
  /** Phần trả sau giao của hợp đồng đã ký còn nợ + phí huỷ chưa trả. */
  exposure: z.number(),
  /** Hạn mức − dư nợ (không âm). */
  availableCredit: z.number().nullish(),
  currency: z.string(),
  hasOverdue: z.boolean(),
  /** Số còn phải trả trên các đợt quá hạn. */
  overdueAmount: z.number().nullish(),
  oldestOverdueDueDate: z.string().nullish(),
});
