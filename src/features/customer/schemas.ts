/**
 * Khách hàng B2B — hợp đồng BE local integration d215f6e (CustomerController,
 * CustomerOnboardingController, CreditProfileController; handoff SCRUM-429/450).
 *
 * Jackson `non_null`: trường null bị BỎ khỏi JSON → response dùng `.nullish()`.
 * Hai lớp schema (api-conventions §3.1): `*Dto` = BE trả về, `*Input` = form gửi đi.
 */

import { z } from "zod";

import { CUSTOMER_API_STATUSES, SALES_ONBOARDING_PAYMENT_TERMS } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";
import { depositPercentText } from "@/lib/validation/primitives";

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
export const INVITATION_STATES = [
  "PENDING",
  "EXPIRED",
  "ACTIVATED",
  "NO_ACCOUNT",
  "UNAVAILABLE",
] as const;

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
  /** false = chưa từng cấu hình hạn mức / kỳ hạn công nợ, version = -1. */
  configured: z.boolean(),
  // Không còn điều khoản thanh toán theo khách / đơn: khách trả theo lịch thanh toán của hợp đồng
  // (docs 15 BR-01, docs 18 §2) — BE `CreditProfileResponse` chỉ còn hạn mức và kỳ hạn công nợ.
  creditLimit: z.number().nullish(),
  creditTermDays: z.number().int().nullish(),
  currency: z.string(),
  approvedBy: z.string().nullish(),
  approvedAt: z.string().nullish(),
  note: z.string().nullish(),
  version: z.number().int(),
});

const bankAccountDtoSchema = z.object({
  accountNumber: z.string(),
  bankName: z.string(),
  accountHolder: z.string(),
});

/** `GET /customers/{id}/legal-profile` — Jackson `non_null`: `taxCode`, `invoiceEmail`, `bankAccount` có thể vắng. */
export const legalProfileDtoSchema = z.object({
  customerId: z.string(),
  /** Chỉ đọc: lấy từ hồ sơ khách. */
  companyName: z.string(),
  taxCode: z.string().nullish(),
  registeredAddress: z.string(),
  representativeName: z.string(),
  representativeTitle: z.string(),
  invoiceEmail: z.string().nullish(),
  bankAccount: bankAccountDtoSchema.nullish(),
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
 * Khi có: 10 số, 10-3 số, hoặc 12 số CCCD của chủ hộ (BE `TaxCode`, V20261017000540).
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
    depositPercent: z.string().trim(),
  })
  // BE: depositPercent bắt buộc KHI VÀ CHỈ KHI chọn DEPOSIT (CreateBusinessCustomerRequest). Điều khoản
  // khác: ô bị ẩn mà form vẫn giữ giá trị cũ (api.ts bỏ nó) → không kiểm, kẻo chặn submit không lỗi.
  .superRefine((v, ctx) => {
    if (v.paymentTerm !== "DEPOSIT") return;
    const message =
      v.depositPercent === ""
        ? "Nhập tỷ lệ cọc đã thoả thuận"
        : depositPercentText.safeParse(v.depositPercent).error?.issues[0]?.message;
    if (message) ctx.addIssue({ code: "custom", path: ["depositPercent"], message });
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

/* ── Hồ sơ pháp lý (BE `CustomerLegalProfileService`: lỗi dữ liệu là 400 không kèm `fieldErrors`, nên FE chép đủ luật) ── */

/** BE: số tài khoản sau khi bỏ khoảng trắng / `.` / `-` phải khớp `[0-9A-Za-z]{4,34}`. */
const BANK_ACCOUNT_SEPARATORS = /[\s.-]/g;
const BANK_ACCOUNT_NUMBER = /^[0-9A-Za-z]{4,34}$/;
/** BE: `[^@\s]+@[^@\s]+\.[^@\s]+`. */
const INVOICE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const LEGAL_BANK_FIELDS = ["accountNumber", "bankName", "accountHolder"] as const;
const LEGAL_BANK_REQUIRED = {
  accountNumber: "Nhập số tài khoản",
  bankName: "Nhập ngân hàng",
  accountHolder: "Nhập chủ tài khoản",
} as const;

export const legalProfileInputSchema = z
  .object({
    registeredAddress: z
      .string()
      .trim()
      .min(1, "Nhập địa chỉ đăng ký kinh doanh")
      .max(500, "Tối đa 500 ký tự"),
    representativeName: z
      .string()
      .trim()
      .min(1, "Nhập người đại diện theo pháp luật")
      .max(200, "Tối đa 200 ký tự"),
    representativeTitle: z.string().trim().min(1, "Nhập chức vụ").max(100, "Tối đa 100 ký tự"),
    invoiceEmail: z
      .string()
      .trim()
      .max(320, "Tối đa 320 ký tự")
      .refine((v) => v === "" || INVOICE_EMAIL.test(v), { message: "Email không hợp lệ" }),
    accountNumber: z.string().trim(),
    bankName: z.string().trim().max(200, "Tối đa 200 ký tự"),
    accountHolder: z.string().trim().max(200, "Tối đa 200 ký tự"),
  })
  // BE: cả ba ô ngân hàng trống = không có tài khoản; có một ô thì phải đủ ba và số tài khoản đúng dạng.
  .superRefine((v, ctx) => {
    if (LEGAL_BANK_FIELDS.every((field) => v[field] === "")) return;
    for (const field of LEGAL_BANK_FIELDS) {
      if (v[field] === "")
        ctx.addIssue({ code: "custom", path: [field], message: LEGAL_BANK_REQUIRED[field] });
    }
    if (
      v.accountNumber !== "" &&
      !BANK_ACCOUNT_NUMBER.test(v.accountNumber.replace(BANK_ACCOUNT_SEPARATORS, ""))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["accountNumber"],
        message: "Số tài khoản gồm 4–34 chữ hoặc số (bỏ qua khoảng trắng, dấu chấm, gạch ngang)",
      });
    }
  });
