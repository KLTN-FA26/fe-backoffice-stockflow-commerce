import { INVENTORY_ITEM_ERROR_MESSAGES as MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import type { LogisticsFormValues } from "./types";

type Context = "load" | "logistics";
type FieldKey = keyof LogisticsFormValues;

function isKnown(code: string): code is keyof typeof MESSAGES {
  return Object.hasOwn(MESSAGES, code);
}

/** Mã lỗi BE → câu tiếng Việt; mã lạ → câu chung. 403 → FORBIDDEN. */
export function inventoryItemErrorMessage(error: unknown, context: Context): string {
  if (!(error instanceof ApiError)) return MESSAGES.generic;
  // Lưu logistics: đổi đơn vị tính khi còn tồn
  if (error.code === "INVENTORY_POLICY_STOCK_CONFLICT" && context === "logistics") {
    return MESSAGES.UOM_STOCK_CONFLICT;
  }
  if (isKnown(error.code)) return MESSAGES[error.code];
  if (error.status === 403) return MESSAGES.FORBIDDEN;
  return MESSAGES.generic;
}

/** Lỗi theo ô từ BE: vài mã lỗi không kèm fieldErrors nhưng chỉ đúng một ô — gán theo mã. */
export function inventoryItemFieldErrors(
  error: unknown,
  context?: Context,
): Partial<Record<FieldKey, string>> {
  if (!(error instanceof ApiError)) return {};
  // BE #121 InventoryItemsImpl.saveLogistics: đơn vị tính mới trùng một đơn vị đóng gói của SKU
  if (error.code === "UOM_CONVERSION_DUPLICATE" && context === "logistics") {
    return { unitOfMeasure: MESSAGES.UOM_CONVERSION_DUPLICATE };
  }
  return {};
}

/** Item đã đổi / biến mất — màn hình tải lại thay vì cho lưu tiếp. */
export function isStaleItemError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === "OPTIMISTIC_LOCK" || error.code === "INVENTORY_ITEM_NOT_FOUND")
  );
}
