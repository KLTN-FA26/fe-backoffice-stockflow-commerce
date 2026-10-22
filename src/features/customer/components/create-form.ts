import type { CustomerCreateValues } from "@/features/customer/types";

export const DEFAULTS: CustomerCreateValues = {
  companyName: "",
  taxCode: "",
  contactName: "",
  email: "",
  phone: "",
  paymentTerm: "PREPAID",
  depositPercent: "",
};

/** Lỗi nghiệp vụ 409 trỏ đúng trường để người dùng sửa tại chỗ. */
export const FIELD_BY_ERROR: Readonly<Record<string, keyof CustomerCreateValues>> = {
  CUSTOMER_TAX_CODE_ALREADY_EXISTS: "taxCode",
  CUSTOMER_EMAIL_ALREADY_EXISTS: "email",
  USER_EMAIL_ALREADY_EXISTS: "email",
  CREDIT_PROFILE_INVALID: "depositPercent",
};

export function isFormField(name: string): name is keyof CustomerCreateValues {
  return name in DEFAULTS;
}
