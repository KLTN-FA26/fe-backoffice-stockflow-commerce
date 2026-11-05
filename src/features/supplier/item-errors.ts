/**
 * Supplier item — map lỗi BE → câu tiếng Việt và ô form.
 *
 * `ApiError.fieldErrors` chỉ giữ message đầu của mỗi field (không giữ `code` của field), nên map
 * theo `error.code` (envelope) + tên field. Mọi lỗi hiển thị tiếng Việt, không dùng message thô.
 */

import { SUPPLIER_ITEM_ERROR_MESSAGES, SUPPLIER_ITEM_FIELD_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import type { SupplierItemFormValues } from "./types";

type ItemField = keyof SupplierItemFormValues;
type KnownCode = Exclude<keyof typeof SUPPLIER_ITEM_ERROR_MESSAGES, "generic">;
type MessagedField = keyof typeof SUPPLIER_ITEM_FIELD_MESSAGES;

/** errorCode → ô form cần gắn lỗi (BE `SupplierItemServiceImpl`, `SupplierItemTerms`). */
const CODE_FIELD: Partial<Record<KnownCode, ItemField>> = {
  SUPPLIER_ITEM_DUPLICATE: "sku",
  SKU_NOT_PURCHASABLE: "sku",
  INVENTORY_ITEM_NOT_FOUND: "sku",
  SUPPLIER_ITEM_SKU_INVALID: "sku",
  SUPPLIER_ITEM_SUPPLIER_SKU_CODE_TOO_LONG: "supplierSkuCode",
  SUPPLIER_ITEM_PRICE_INVALID: "price",
  SUPPLIER_ITEM_MOQ_INVALID: "moq",
  SUPPLIER_ITEM_MOQ_NOT_PACK_MULTIPLE: "moq",
  SUPPLIER_ITEM_PACK_SIZE_INVALID: "packSize",
  SUPPLIER_ITEM_LEAD_TIME_INVALID: "leadTimeDays",
};

function isKnownCode(code: string): code is KnownCode {
  return code !== "generic" && code in SUPPLIER_ITEM_ERROR_MESSAGES;
}

function isMessagedField(name: string): name is MessagedField {
  return name in SUPPLIER_ITEM_FIELD_MESSAGES;
}

/** Lỗi theo ô form: field BE → ô; lỗi theo mã nghiệp vụ gắn vào `sku` hoặc ô tương ứng. */
export function supplierItemFieldErrors(
  error: ApiError,
): Partial<Record<keyof SupplierItemFormValues, string>> {
  const out: Partial<Record<keyof SupplierItemFormValues, string>> = {};
  if (isKnownCode(error.code)) {
    const field = CODE_FIELD[error.code];
    if (field) out[field] = SUPPLIER_ITEM_ERROR_MESSAGES[error.code];
  }
  for (const name of Object.keys(error.fieldErrors ?? {})) {
    if (isMessagedField(name) && out[name] === undefined) {
      out[name] = SUPPLIER_ITEM_FIELD_MESSAGES[name];
    }
  }
  return out;
}

/** Câu tiếng Việt cho một lỗi bất kỳ khi thao tác với danh mục hàng. */
export function supplierItemErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (isKnownCode(error.code)) return SUPPLIER_ITEM_ERROR_MESSAGES[error.code];
    const fieldTexts = Object.keys(error.fieldErrors ?? {})
      .filter(isMessagedField)
      .map((name) => SUPPLIER_ITEM_FIELD_MESSAGES[name]);
    if (fieldTexts.length > 0) return fieldTexts.join("; ");
  }
  return SUPPLIER_ITEM_ERROR_MESSAGES.generic;
}
