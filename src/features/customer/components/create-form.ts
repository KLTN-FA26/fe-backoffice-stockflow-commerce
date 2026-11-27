import type { CustomerCreateFormValues } from "@/features/customer/types";

export const DEFAULTS: CustomerCreateFormValues = {
  companyName: "",
  taxCode: "",
  contactName: "",
  email: "",
  phone: "",
  taxCodeExemption: false,
  exemptionReason: "",
  salesOwnerId: "",
  leadId: "",
};

/**
 * Ô điền sẵn từ đường dẫn (KE-HOACH sales-owner §10.7: "Chuyển thành khách" từ khách tiềm năng mở form này với thông tin của
 * lead và `leadId`). Chỉ các ô nhập chữ; không nhận cờ miễn MST hay người phụ trách qua URL.
 */
export const PREFILL_FIELDS = [
  "companyName",
  "taxCode",
  "contactName",
  "email",
  "phone",
  "leadId",
] as const satisfies readonly (keyof CustomerCreateFormValues)[];
export type PrefillField = (typeof PREFILL_FIELDS)[number];

/** BE giới hạn mỗi ô ≤ 320 ký tự; URL dài hơn bị cắt, không làm hỏng form. */
const PREFILL_MAX = 320;

export function prefilledDefaults(
  params: Readonly<Partial<Record<PrefillField, string | null>>>,
): CustomerCreateFormValues {
  const values: CustomerCreateFormValues = { ...DEFAULTS };
  for (const field of PREFILL_FIELDS) {
    const raw = params[field];
    if (raw) values[field] = raw.trim().slice(0, PREFILL_MAX);
  }
  return values;
}

/** Lỗi nghiệp vụ trỏ đúng trường để người dùng sửa tại chỗ. */
export const FIELD_BY_ERROR: Readonly<Record<string, keyof CustomerCreateFormValues>> = {
  CUSTOMER_TAX_CODE_ALREADY_EXISTS: "taxCode",
  // BR-S14: BE đòi MST (vd Sale không có quyền miễn).
  CUSTOMER_TAX_CODE_REQUIRED: "taxCode",
  CUSTOMER_EMAIL_ALREADY_EXISTS: "email",
  USER_EMAIL_ALREADY_EXISTS: "email",
  // BR-S04: người được chọn không còn là Sale đang làm.
  SALES_OWNER_NOT_ASSIGNABLE: "salesOwnerId",
};

export function isFormField(name: string): name is keyof CustomerCreateFormValues {
  return name in DEFAULTS;
}
