import { PRODUCT_STATUS } from "@/constants";
import { formatVND } from "@/lib/format";

import type { Category, Product } from "./types";

export { formatVND as formatVnd };

export function categoryName(categoryId: string | null, categories: readonly Category[]): string {
  if (categoryId === null) return "Chưa chọn danh mục";
  return categories.find((category) => category.categoryId === categoryId)?.name.vi ?? "—";
}

export function shouldFlagProductRow(product: Product): boolean {
  return (
    product.status === PRODUCT_STATUS.PENDING_APPROVAL ||
    product.status === PRODUCT_STATUS.DISCONTINUED
  );
}
