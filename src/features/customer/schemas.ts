/**
 * Khách hàng B2B — hợp đồng BE local integration d215f6e (CustomerController,
 * CustomerOnboardingController, CreditProfileController; handoff SCRUM-429/450).
 *
 * Jackson `non_null`: trường null bị BỎ khỏi JSON → response dùng `.nullish()`.
 * Hai lớp schema (api-conventions §3.1): `*Dto` = BE trả về, `*Input` = form gửi đi.
 */

import { z } from "zod";

import { CUSTOMER_API_STATUSES, PAYMENT_TERMS, SALES_ONBOARDING_PAYMENT_TERMS } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

/* ── DTO ─────────────────────────────────────────────────────────────── */

export const customerDtoSchema = z.object({
  customerId: z.string(),
  userId: z.string().nullish(),
  /** B2B: tên công ty. */
  fullName: z.string(),
  email: z.string(),
  phone: z.string().nullish(),
  taxCode: z.string().nullish(),
  segmentId: z.string().nullish(),
  status: z.enum(CUSTOMER_API_STATUSES),
  version: z.number().int(),
  createdAt: z.string(),
});

export const customerPageDtoSchema = bePageSchema(customerDtoSchema);

export const customerStatusEntryDtoSchema = z.object({
  fromStatus: z.enum(CUSTOMER_API_STATUSES).nullish(),
  toStatus: z.enum(CUSTOMER_API_STATUSES),
  reason: z.string().nullish(),
  changedBy: z.string().nullish(),
  changedAt: z.string(),
});
export const customerStatusHistoryDtoSchema = z.array(customerStatusEntryDtoSchema);

export const INVITATION_DELIVERIES = ["SENT", "FAILED"] as const;
export const INVITATION_STATES = ["PENDING", "EXPIRED", "ACTIVATED", "NO_ACCOUNT"] as const;

export const invitedCustomerDtoSchema = z.object({
  customer: customerDtoSchema,
  invitation: z.object({
    issuedAt: z.string(),
    expiresAt: z.string(),
    delivery: z.enum(INVITATION_DELIVERIES),
  }),
});

export const portalInvitationDtoSchema = z.object({
  customerId: z.string(),
  state: z.enum(INVITATION_STATES),
  issuedAt: z.string().nullish(),
  expiresAt: z.string().nullish(),
  delivery: z.enum(INVITATION_DELIVERIES).nullish(),
});

export const creditProfileDtoSchema = z.object({
  customerId: z.string(),
  /** false = chưa từng cấu hình → chỉ trả trước, version = -1. */
  configured: z.boolean(),
  allowPrepaid: z.boolean(),
  allowDeposit: z.boolean(),
  allowCredit: z.boolean(),
  defaultPaymentTerm: z.enum(PAYMENT_TERMS),
  depositPercent: z.number().nullish(),
  creditLimit: z.number().nullish(),
  creditTermDays: z.number().int().nullish(),
  currency: z.string(),
  approvedBy: z.string().nullish(),
  approvedAt: z.string().nullish(),
  note: z.string().nullish(),
  version: z.number().int(),
});

export const portalActivationDtoSchema = z.object({ email: z.string() });

/* ── Input ───────────────────────────────────────────────────────────── */

/** SĐT Việt Nam — mirror BE `@VietnamPhone` (bỏ khoảng trắng, chấm, gạch, ngoặc). */
const VN_PHONE = /^(?:\+?84|0)(?:[35789]\d{8}|2\d{9})$/;
const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === "" || VN_PHONE.test(v.replace(/[\s.\-()]/g, "")), {
    message: "Số điện thoại Việt Nam không hợp lệ",
  });

/**
 * MST KHÔNG bắt buộc (quyết định 2026-10-12: hộ kinh doanh / cửa hàng nhỏ được thiếu MST).
 * Khi có: 10 số, 10-3 số, hoặc 12 số CCCD của chủ hộ (BE `TaxCode`, V20261015000540).
 */
const TAX_CODE = /^\d{10}(-\d{3})?$|^\d{12}$/;
export function normalizeTaxCode(raw: string): string {
  const compact = raw.trim().replace(/[\s.]/g, "");
  return /^\d{13}$/.test(compact) ? `${compact.slice(0, 10)}-${compact.slice(10)}` : compact;
}
const optionalTaxCode = z
  .string()
  .trim()
  .max(20, "Tối đa 20 ký tự")
  .refine((v) => v === "" || TAX_CODE.test(normalizeTaxCode(v)), {
    message: "MST gồm 10 số, 10-3 số, hoặc 12 số",
  });

/** % cọc: 0 < x < 100, tối đa 2 chữ số thập phân (BE `@Digits(3,2)`, NUMERIC(5,2)). */
const depositPercentText = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{1,2}(\.\d{1,2})?$/.test(v), {
    message: "Nhập số từ 0,01 đến 99,99 (tối đa 2 chữ số thập phân)",
  })
  .refine((v) => v === "" || (Number(v) > 0 && Number(v) < 100), {
    message: "Tỷ lệ cọc phải lớn hơn 0 và nhỏ hơn 100",
  });

export const customerCreateInputSchema = z
  .object({
    companyName: z
      .string()
      .trim()
      .min(1, "Nhập tên công ty / cửa hàng")
      .max(200, "Tối đa 200 ký tự"),
    taxCode: optionalTaxCode,
    contactName: z.string().trim().min(1, "Nhập người liên hệ").max(200, "Tối đa 200 ký tự"),
    email: z.email("Email không hợp lệ").max(320, "Tối đa 320 ký tự"),
    phone: optionalPhone,
    // B1 (SPRINT2-FINISH-DECISIONS 2026-10-13): Sales chọn PREPAID hoặc DEPOSIT; CREDIT thuộc
    // người duyệt công nợ hiện có → không có trong form tạo khách.
    paymentTerm: z.enum(SALES_ONBOARDING_PAYMENT_TERMS),
    depositPercent: depositPercentText,
  })
  // BE: depositPercent bắt buộc KHI VÀ CHỈ KHI chọn DEPOSIT (CreateBusinessCustomerRequest)
  .refine((v) => v.paymentTerm !== "DEPOSIT" || v.depositPercent !== "", {
    path: ["depositPercent"],
    message: "Nhập tỷ lệ cọc đã thoả thuận",
  });

export const customerUpdateInputSchema = z.object({
  fullName: z.string().trim().min(1, "Nhập tên công ty / cửa hàng").max(200, "Tối đa 200 ký tự"),
  phone: optionalPhone,
  taxCode: optionalTaxCode,
});

/** Mật khẩu portal — BE `PasswordPolicy`: 10–72 ký tự, có chữ hoa, chữ thường, chữ số. */
export const portalPasswordSchema = z
  .string()
  .min(10, "Tối thiểu 10 ký tự")
  .max(72, "Tối đa 72 ký tự")
  .regex(/\p{Lu}/u, "Cần ít nhất một chữ hoa")
  .regex(/\p{Ll}/u, "Cần ít nhất một chữ thường")
  .regex(/\p{Nd}/u, "Cần ít nhất một chữ số");

export const portalActivationInputSchema = z
  .object({ password: portalPasswordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu nhập lại không khớp",
  });

/** Token mời: đúng 64 ký tự base64url (BE `PortalInvitationToken`). */
export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{64}$/);
