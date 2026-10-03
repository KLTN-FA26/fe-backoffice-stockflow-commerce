/**
 * Lỗi BE khi tạo PO → lỗi INLINE của từng ô form (theo mẫu `supplierFieldErrors`, SCRUM-389).
 * Tên field BE (Spring `MethodArgumentNotValidException`: `supplierId`, `lines[0].quantityOrdered`)
 * được đổi sang path react-hook-form (`supplierId`, `lines.0.orderedQty`).
 */

import { PO_CREATE_FIELD_MESSAGES, PO_ERROR_MESSAGES } from "@/constants";

import type { FieldPath } from "react-hook-form";
import type { ApiError } from "@/lib/api/error";
import type { PoCreateFormValues } from "./create-form-schema";

export type PoCreateFieldPath = FieldPath<PoCreateFormValues>;

export interface PoCreateFieldError {
  field: PoCreateFieldPath;
  message: string;
}

/** Field cấp PO của BE `CreatePurchaseOrderRequest` → field form. */
const ORDER_FIELDS = {
  supplierId: "supplierId",
  currency: "currency",
  expectedAt: "expectedDate",
  lines: "lines",
} as const satisfies Record<string, PoCreateFieldPath>;

/** Field dòng của BE `CreatePOLineRequest` → field dòng của form. */
const LINE_FIELDS = {
  sku: "skuId",
  description: "description",
  quantityOrdered: "orderedQty",
  unitPrice: "unitPrice",
} as const;

const LINE_PATH = /^lines\[(\d+)\]\.(\w+)$/;

function isKey<T extends object>(obj: T, key: string): key is Extract<keyof T, string> {
  return Object.hasOwn(obj, key);
}

function mapField(name: string): PoCreateFieldError | null {
  if (isKey(ORDER_FIELDS, name)) {
    const field = ORDER_FIELDS[name];
    return { field, message: PO_CREATE_FIELD_MESSAGES[field] };
  }
  const line = LINE_PATH.exec(name);
  const index = line?.[1];
  const beField = line?.[2];
  if (index === undefined || beField === undefined || !isKey(LINE_FIELDS, beField)) return null;
  const field = LINE_FIELDS[beField];
  return { field: `lines.${Number(index)}.${field}`, message: PO_CREATE_FIELD_MESSAGES[field] };
}

/**
 * Lỗi gắn được vào ô. Lỗi không có field (vd BE `IllegalArgumentException` → 400 chung) trả mảng
 * rỗng — nơi gọi hiện toast bằng `poErrorMessage`.
 */
export function poCreateFieldErrors(error: ApiError): PoCreateFieldError[] {
  const out: PoCreateFieldError[] = [];
  // BE createPurchaseOrder: NCC không tồn tại (404) / ngừng hợp tác (409) → ô Nhà cung cấp.
  if (error.code === "SUPPLIER_NOT_FOUND" || error.code === "SUPPLIER_INACTIVE") {
    out.push({ field: "supplierId", message: PO_ERROR_MESSAGES[error.code] });
  }
  for (const name of Object.keys(error.fieldErrors ?? {})) {
    const mapped = mapField(name);
    if (mapped) out.push(mapped);
  }
  return out;
}
