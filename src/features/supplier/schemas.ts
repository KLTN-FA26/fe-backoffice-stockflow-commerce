/**
 * Supplier — zod schemas, khớp hợp đồng BE PR #36 (SupplierController).
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

/* ── Input (form gửi đi) — ràng buộc theo BE SaveSupplierRequest (PR #36) ─ */

// BE: @Pattern("[A-Za-z0-9._-]+") @Size(max = 64) — BE không tự sinh mã
const CODE_REGEX = /^[A-Za-z0-9._-]+$/;
// BE: chữ-số 8–32 ký tự, có ít nhất 1 chữ số — chấp nhận MST nước ngoài (BR-07 docs 02: PO bằng USD)
const TAX_CODE_REGEX = /^(?=.*[0-9])[0-9A-Za-z][0-9A-Za-z-]{6,30}[0-9A-Za-z]$/;
// BE: @Pattern("^\+?[0-9](?:[0-9 .()-]*[0-9])?$") + isPhoneDigitsValid (8–15 chữ số)
const PHONE_REGEX = /^\+?[0-9](?:[0-9 .()-]*[0-9])?$/;
const PHONE_MIN_DIGITS = 8;
const PHONE_MAX_DIGITS = 15;
const TERM_DAYS_MAX = 365;
const HTTPS_PORT = "443";

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

const termDays = (label: string) =>
  z
    .number({ error: `${label} phải là số` })
    .int(`${label} phải là số nguyên`)
    .min(0, `${label} không được âm`)
    .max(TERM_DAYS_MAX, `${label} tối đa ${TERM_DAYS_MAX} ngày`);

export const supplierFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, "Mã nhà cung cấp không được để trống")
      .max(64, "Mã nhà cung cấp tối đa 64 ký tự")
      .regex(CODE_REGEX, "Mã chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới"),
    name: z
      .string()
      .trim()
      .min(1, "Tên nhà cung cấp không được để trống")
      .max(200, "Tên nhà cung cấp tối đa 200 ký tự"),
    taxCode: z
      .string()
      .trim()
      .refine(
        (v) => v === "" || TAX_CODE_REGEX.test(v),
        "Mã số thuế gồm 8–32 ký tự chữ/số, có ít nhất 1 chữ số",
      ),
    contactName: z.string().trim().max(200, "Tên người liên hệ tối đa 200 ký tự"),
    email: z
      .string()
      .trim()
      .max(320, "Email tối đa 320 ký tự")
      .refine((v) => v === "" || z.email().safeParse(v).success, "Email không hợp lệ"),
    phone: z
      .string()
      .trim()
      .max(32, "Số điện thoại tối đa 32 ký tự")
      .refine((v) => v === "" || PHONE_REGEX.test(v), "Số điện thoại không hợp lệ")
      .refine((v) => {
        if (v === "") return true;
        const digits = countDigits(v);
        return digits >= PHONE_MIN_DIGITS && digits <= PHONE_MAX_DIGITS;
      }, SUPPLIER_ERROR_MESSAGES.invalidPhoneDigits),
    paymentTermDays: termDays("Số ngày thanh toán"),
    leadTimeDays: termDays("Thời gian giao hàng"),
    communicationChannel: supplierChannelSchema,
    apiEndpoint: z.string().trim().max(500, "Endpoint tối đa 500 ký tự"),
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
