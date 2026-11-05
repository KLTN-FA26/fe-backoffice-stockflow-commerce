/**
 * Supplier — zod schemas, khớp hợp đồng BE SupplierController (PR #36, cập nhật PR #71).
 *
 * Hai lớp (api-conventions §3.1):
 *  - DTO: `supplierApiDtoSchema` = đúng `SupplierResponse` trên wire; `supplierDtoSchema` = model FE
 *    (chỉ khác `status` hiển thị Active/Inactive, map ở api.ts).
 *  - Input: `supplierFormSchema` = dữ liệu form, mô phỏng ràng buộc `SaveSupplierRequest`.
 *
 * BE không có address/rating/currency/openPoCount → FE không giữ các field này.
 */

import { z } from "zod";

import {
  SUPPLIER_API_STATUSES,
  SUPPLIER_CHANNELS,
  SUPPLIER_ERROR_MESSAGES,
  SUPPLIER_FIELD_LABELS,
  SUPPLIER_STATUSES,
} from "@/constants";

/* ── Enums ───────────────────────────────────────────────────────────── */

export const supplierStatusSchema = z.enum(SUPPLIER_STATUSES);
export const supplierApiStatusSchema = z.enum(SUPPLIER_API_STATUSES);
export const supplierChannelSchema = z.enum(SUPPLIER_CHANNELS);

/* ── DTO (response từ BE) ────────────────────────────────────────────── */

/** BE `SupplierResponse` (PR #36). Field tuỳ chọn trả `null` khi trống. */
export const supplierApiDtoSchema = z.object({
  supplierId: z.string().min(1),
  code: z.string(),
  name: z.string(),
  contactName: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  taxCode: z.string().nullish(),
  status: supplierApiStatusSchema,
  paymentTermDays: z.number().int(),
  leadTimeDays: z.number().int(),
  communicationChannel: supplierChannelSchema,
  apiEndpoint: z.string().nullish(),
  // BE PR #71: dung sai nhận vượt (%), NCC in gia công + dung sai hao hụt (%) (SCRUM-433/434).
  overReceiptTolerancePercent: z.coerce.number().nullish(),
  printSubcontractor: z.boolean().default(false),
  lossTolerancePercent: z.coerce.number().nullish(),
  createdAt: z.string().nullish(),
  lastModifiedAt: z.string().nullish(),
});

/** BE `PageResponse` — trang đánh số từ 0. */
export const supplierPageSchema = z.object({
  items: z.array(supplierApiDtoSchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
});

/** Model FE: giữ nguyên field BE, chỉ đổi status sang nhãn hiển thị. */
export const supplierDtoSchema = supplierApiDtoSchema.extend({
  status: supplierStatusSchema,
});

/* ── Input (form gửi đi) — ràng buộc theo BE SaveSupplierRequest (PR #71) ─ */

// BE: @Pattern("[A-Za-z0-9][A-Za-z0-9_-]*") @Size(max = 30), server upper-case — BE không tự sinh mã
const CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
// BE: chữ-số 8–30 ký tự, có ít nhất 1 chữ số — chấp nhận MST nước ngoài (BR-07 docs 02: PO bằng USD)
const TAX_CODE_REGEX = /^(?=.*[0-9])[0-9A-Za-z][0-9A-Za-z-]{6,28}[0-9A-Za-z]$/;
// BE: @Pattern("^\+?[0-9](?:[0-9 .()-]*[0-9])?$") + isPhoneDigitsValid (8–15 chữ số)
const PHONE_REGEX = /^\+?[0-9](?:[0-9 .()-]*[0-9])?$/;
const HTTPS_PORT = "443";

/** Giới hạn theo BE SaveSupplierRequest (PR #71): @Size / @Min / @Max / isPhoneDigitsValid. */
export const SUPPLIER_LIMITS = {
  codeMax: 30,
  nameMax: 200,
  contactNameMax: 150,
  emailMax: 150,
  phoneMax: 30,
  phoneDigitsMin: 8,
  phoneDigitsMax: 15,
  apiEndpointMax: 500,
  termDaysMax: 365,
  percentMax: 100,
} as const;

const L = SUPPLIER_FIELD_LABELS;
const tooLong = (label: string, max: number) => `${label} tối đa ${max} ký tự`;

function countDigits(value: string): number {
  return value.replace(/\D/g, "").length;
}

/** BE `isDeliveryContactValid` cho kênh API: https, có host, không userinfo/query/fragment, cổng 443. */
export function isValidApiEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname !== "" &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === "" &&
      (url.port === "" || url.port === HTTPS_PORT)
    );
  } catch {
    return false;
  }
}

/** BE `@DecimalMin("0") @DecimalMax("100")`, tuỳ chọn (null = theo mặc định của hệ thống). */
const optionalPercent = (label: string) =>
  z
    .number({ error: `${label} phải là số` })
    .min(0, `${label} không được âm`)
    .max(SUPPLIER_LIMITS.percentMax, `${label} tối đa ${SUPPLIER_LIMITS.percentMax}%`)
    .nullable();

const termDays = (label: string) =>
  z
    .number({ error: `${label} phải là số` })
    .int(`${label} phải là số nguyên`)
    .min(0, `${label} không được âm`)
    .max(SUPPLIER_LIMITS.termDaysMax, `${label} tối đa ${SUPPLIER_LIMITS.termDaysMax} ngày`);

export const supplierFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, `${L.code} không được để trống`)
      .max(SUPPLIER_LIMITS.codeMax, tooLong(L.code, SUPPLIER_LIMITS.codeMax))
      .regex(CODE_REGEX, "Mã chỉ gồm chữ, số, gạch ngang, gạch dưới; bắt đầu bằng chữ hoặc số"),
    name: z
      .string()
      .trim()
      .min(1, `${L.name} không được để trống`)
      .max(SUPPLIER_LIMITS.nameMax, tooLong(L.name, SUPPLIER_LIMITS.nameMax)),
    taxCode: z
      .string()
      .trim()
      .refine(
        (v) => v === "" || TAX_CODE_REGEX.test(v),
        `${L.taxCode} gồm 8–30 ký tự chữ/số, có ít nhất 1 chữ số`,
      ),
    contactName: z
      .string()
      .trim()
      .max(SUPPLIER_LIMITS.contactNameMax, tooLong(L.contactName, SUPPLIER_LIMITS.contactNameMax)),
    email: z
      .string()
      .trim()
      .max(SUPPLIER_LIMITS.emailMax, tooLong(L.email, SUPPLIER_LIMITS.emailMax))
      .refine((v) => v === "" || z.email().safeParse(v).success, "Email không hợp lệ"),
    phone: z
      .string()
      .trim()
      .max(SUPPLIER_LIMITS.phoneMax, tooLong(L.phone, SUPPLIER_LIMITS.phoneMax))
      .refine((v) => v === "" || PHONE_REGEX.test(v), `${L.phone} không hợp lệ`)
      .refine((v) => {
        if (v === "") return true;
        const digits = countDigits(v);
        return digits >= SUPPLIER_LIMITS.phoneDigitsMin && digits <= SUPPLIER_LIMITS.phoneDigitsMax;
      }, SUPPLIER_ERROR_MESSAGES.invalidPhoneDigits),
    paymentTermDays: termDays(L.paymentTermDays),
    leadTimeDays: termDays(L.leadTimeDays),
    communicationChannel: supplierChannelSchema,
    apiEndpoint: z
      .string()
      .trim()
      .max(SUPPLIER_LIMITS.apiEndpointMax, tooLong(L.apiEndpoint, SUPPLIER_LIMITS.apiEndpointMax)),
    overReceiptTolerancePercent: optionalPercent(L.overReceiptTolerancePercent),
    printSubcontractor: z.boolean(),
    lossTolerancePercent: optionalPercent(L.lossTolerancePercent),
  })
  .superRefine((v, ctx) => {
    // BE SaveSupplierRequest.isDeliveryContactValid (PR #36): kênh EMAIL cần email, kênh API cần endpoint https
    if (v.communicationChannel === "EMAIL" && v.email === "") {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: SUPPLIER_ERROR_MESSAGES.emailRequiredForEmailChannel,
      });
    }
    if (v.communicationChannel === "API" && !isValidApiEndpoint(v.apiEndpoint)) {
      ctx.addIssue({
        code: "custom",
        path: ["apiEndpoint"],
        message: SUPPLIER_ERROR_MESSAGES.invalidApiEndpoint,
      });
    }
  });

/* ── Mutation inputs ─────────────────────────────────────────────────── */

/** PUT là thay toàn bộ (BE PR #36) → luôn gửi đủ form + status hiện tại. */
export const supplierUpdateInputSchema = z.object({
  id: z.string().min(1),
  values: supplierFormSchema,
  status: supplierStatusSchema,
});
