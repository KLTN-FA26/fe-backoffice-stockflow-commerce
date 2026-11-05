/**
 * Lỗi BE khi tạo PO → lỗi INLINE của từng ô form (theo mẫu `supplierFieldErrors`, SCRUM-389).
 * Tên field BE (Spring `MethodArgumentNotValidException`: `supplierId`, `lines[0].quantityOrdered`)
 * được đổi sang path react-hook-form (`supplierId`, `lines.0.orderedQty`).
 */

import { PO_CREATE_FIELD_MESSAGES, PO_ERROR_MESSAGES } from "@/constants";

import { poQuantityTermsMessage } from "./line-terms";

import type { FieldPath } from "react-hook-form";
import type { ApiError } from "@/lib/api/error";
import type { PoCreateFormLine, PoCreateFormValues } from "./create-form-schema";

export type PoCreateFieldPath = FieldPath<PoCreateFormValues>;

export interface PoCreateFieldError {
  field: PoCreateFieldPath;
  message: string;
}

/** Field cấp PO của BE `CreatePurchaseOrderRequest` → field form. */
const ORDER_FIELDS = {
  supplierId: "supplierId",
  warehouseId: "warehouseId",
  currency: "currency",
  expectedAt: "expectedDate",
  note: "note",
  lines: "lines",
} as const satisfies Record<string, PoCreateFieldPath>;

/** Field dòng của BE `CreatePOLineRequest` → field dòng của form. */
const LINE_FIELDS = {
  sku: "skuId",
  description: "description",
  quantityOrdered: "orderedQty",
  unitPrice: "unitPrice",
  taxRate: "taxRate",
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
 * BE `checkLines` (409 SUPPLIER_TERMS_VIOLATED) gắn lỗi theo ô nhưng `ApiError` chỉ giữ tên field,
 * nên câu lỗi suy từ field: `sku` → không có trong danh mục; `quantityOrdered` → MOQ/quy cách
 * của chính dòng (lấy từ `terms`); `unitPrice` → cần nhập giá (khác tiền tệ danh mục).
 * `SKU_NOT_PURCHASABLE` (409, `requirePurchasable`) chỉ gắn `lines[i].sku`.
 */
function termsLineError(
  code: string,
  name: string,
  lines: readonly PoCreateFormLine[],
): PoCreateFieldError | null {
  const match = LINE_PATH.exec(name);
  const index = Number(match?.[1]);
  const beField = match?.[2];
  if (!match || beField === undefined) return null;
  if (code === "SKU_NOT_PURCHASABLE") {
    return beField === "sku"
      ? { field: `lines.${index}.skuId`, message: PO_ERROR_MESSAGES.SKU_NOT_PURCHASABLE }
      : null;
  }
  if (beField === "sku") {
    return { field: `lines.${index}.skuId`, message: PO_ERROR_MESSAGES.SUPPLIER_ITEM_NOT_LISTED };
  }
  if (beField === "unitPrice") {
    return { field: `lines.${index}.unitPrice`, message: PO_ERROR_MESSAGES.PO_LINE_PRICE_REQUIRED };
  }
  if (beField === "quantityOrdered") {
    const terms = lines[index]?.terms;
    return {
      field: `lines.${index}.orderedQty`,
      message: terms ? poQuantityTermsMessage(terms) : PO_ERROR_MESSAGES.PO_LINE_BELOW_MOQ,
    };
  }
  return null;
}

/**
 * Lỗi gắn được vào ô. Lỗi không có field (vd BE `IllegalArgumentException` → 400 chung) trả mảng
 * rỗng — nơi gọi hiện toast bằng `poErrorMessage`.
 */
export function poCreateFieldErrors(
  error: ApiError,
  lines: readonly PoCreateFormLine[] = [],
): PoCreateFieldError[] {
  const out: PoCreateFieldError[] = [];
  if (error.code === "SUPPLIER_TERMS_VIOLATED" || error.code === "SKU_NOT_PURCHASABLE") {
    for (const name of Object.keys(error.fieldErrors ?? {})) {
      const mapped = termsLineError(error.code, name, lines);
      if (mapped) out.push(mapped);
    }
    return out;
  }
  // BE createPurchaseOrder: NCC không tồn tại (404) / ngừng hợp tác (409) → ô Nhà cung cấp.
  if (error.code === "SUPPLIER_NOT_FOUND" || error.code === "SUPPLIER_INACTIVE") {
    out.push({ field: "supplierId", message: PO_ERROR_MESSAGES[error.code] });
  }
  // BE ProcurementServiceImpl#requireReceivingWarehouse (SCRUM-390): kho nhận không tồn tại (404),
  // ngoài phạm vi kho của người dùng (403, BR-SEC-002) hoặc đã ngừng hoạt động (409) → ô Kho nhận.
  if (error.code === "WAREHOUSE_NOT_FOUND" || error.code === "WAREHOUSE_INACTIVE") {
    out.push({ field: "warehouseId", message: PO_ERROR_MESSAGES[error.code] });
  }
  // Kho mới chọn ngoài phạm vi (BR-SEC-002). Sửa nháp giữ nguyên kho mà 403 = cả đơn ngoài phạm vi —
  // `useEditDraftForm` xử lý trước (về màn chi tiết), không tới đây.
  if (error.code === "OUT_OF_DATA_SCOPE") {
    out.push({ field: "warehouseId", message: PO_ERROR_MESSAGES.warehouseOutOfScope });
  }
  for (const name of Object.keys(error.fieldErrors ?? {})) {
    const mapped = mapField(name);
    if (mapped) out.push(mapped);
  }
  return out;
}
