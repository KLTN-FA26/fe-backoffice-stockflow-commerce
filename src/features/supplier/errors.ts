/**
 * Supplier — map lỗi BE → câu tiếng Việt và ô form (đã thống nhất: mọi lỗi hiển thị tiếng Việt).
 *
 * BE trả 409 trùng mã/MST qua `errorCode`, KHÔNG kèm `fieldErrors` (BE PR #36), nên phải
 * map theo errorCode. Lỗi validate dùng tên trường ảo `deliveryContactValid`/`phoneDigitsValid`.
 */

import { SUPPLIER_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import type { SupplierChannel, SupplierFormValues } from "./types";

type SupplierField = keyof SupplierFormValues;

type KnownErrorCode = Exclude<
  keyof typeof SUPPLIER_ERROR_MESSAGES,
  | "emailRequiredForEmailChannel"
  | "invalidApiEndpoint"
  | "invalidPhoneDigits"
  | "generic"
  | "CODE_IMMUTABLE"
>;

/** errorCode → ô form cần gắn lỗi (nếu có). */
const ERROR_CODE_FIELD: Partial<Record<KnownErrorCode, SupplierField>> = {
  SUPPLIER_CODE_ALREADY_EXISTS: "code",
  SUPPLIER_TAX_CODE_ALREADY_EXISTS: "taxCode",
};

function isKnownErrorCode(code: string): code is KnownErrorCode {
  return code in SUPPLIER_ERROR_MESSAGES;
}

/** Câu tiếng Việt cho một lỗi bất kỳ khi thao tác với NCC. */
export function supplierErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (isKnownErrorCode(error.code)) return SUPPLIER_ERROR_MESSAGES[error.code];
    // BE: "Supplier code is immutable" trả errorCode CONFLICT chung
    if (error.code === "CONFLICT") return SUPPLIER_ERROR_MESSAGES.CODE_IMMUTABLE;
    // BE đã dịch message sang tiếng Việt cho các lỗi còn lại
    if (error.message) return error.message;
  }
  return SUPPLIER_ERROR_MESSAGES.generic;
}

export interface SupplierFieldError {
  field: SupplierField;
  message: string;
}

const FORM_FIELDS: readonly SupplierField[] = [
  "code",
  "name",
  "taxCode",
  "contactName",
  "email",
  "phone",
  "paymentTermDays",
  "leadTimeDays",
  "communicationChannel",
  "apiEndpoint",
];

function isFormField(name: string): name is SupplierField {
  return (FORM_FIELDS as readonly string[]).includes(name);
}

/**
 * ApiError → danh sách lỗi theo ô. `channel` = kênh đang chọn trên form, để biết
 * `deliveryContactValid` thuộc ô email hay apiEndpoint.
 */
export function supplierFieldErrors(
  error: ApiError,
  channel: SupplierChannel,
): SupplierFieldError[] {
  const out: SupplierFieldError[] = [];
  if (isKnownErrorCode(error.code)) {
    const field = ERROR_CODE_FIELD[error.code];
    if (field) out.push({ field, message: SUPPLIER_ERROR_MESSAGES[error.code] });
  }
  for (const [name, message] of Object.entries(error.fieldErrors ?? {})) {
    if (name === "deliveryContactValid") {
      out.push(
        channel === "API"
          ? { field: "apiEndpoint", message: SUPPLIER_ERROR_MESSAGES.invalidApiEndpoint }
          : { field: "email", message: SUPPLIER_ERROR_MESSAGES.emailRequiredForEmailChannel },
      );
    } else if (name === "phoneDigitsValid") {
      out.push({ field: "phone", message: SUPPLIER_ERROR_MESSAGES.invalidPhoneDigits });
    } else if (isFormField(name)) {
      out.push({ field: name, message: message || SUPPLIER_ERROR_MESSAGES.generic });
    }
  }
  return out;
}
