import { PRODUCT_STATUS, UI_LABELS } from "@/constants";
import { formatVND } from "@/lib/format";

import type { Category, Product } from "./types";

export { formatVND as formatVnd };

export function categoryName(categoryId: string | null, categories: readonly Category[]): string {
  if (categoryId === null) return "Chưa chọn danh mục";
  return categories.find((category) => category.categoryId === categoryId)?.name.vi ?? "—";
}

const TAX_CLASS_LABELS: Readonly<Record<string, string>> = UI_LABELS.product.taxClass;

/** `standard` / `STANDARD` (BE `TaxClass`) → "Tiêu chuẩn"; giá trị lạ hiện nguyên văn để không mất dữ liệu. */
export function taxClassLabel(taxClass: string): string {
  return TAX_CLASS_LABELS[taxClass.toUpperCase()] ?? taxClass;
}

/** Dòng "cần chú ý" trong danh sách sản phẩm (viền cảnh báo bên trái — data-table-mode-a). */
export function shouldFlagProductRow(product: Product): boolean {
  return (
    product.status === PRODUCT_STATUS.PENDING_APPROVAL ||
    // Tạm ngưng (BE INACTIVE) đang treo — cần tiếp tục kinh doanh hoặc ngừng hẳn
    product.status === PRODUCT_STATUS.INACTIVE ||
    product.status === PRODUCT_STATUS.DISCONTINUED
  );
}
