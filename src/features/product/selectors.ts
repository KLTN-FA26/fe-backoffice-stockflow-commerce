import { PRODUCT_STATUS } from "@/constants";
import { formatVND } from "@/lib/format";

import type { Category, Product, ProductAttribute } from "./types";

export { formatVND as formatVnd };

export function categoryName(categoryId: string | null, categories: readonly Category[]): string {
  if (categoryId === null) return "Chưa chọn danh mục";
  return categories.find((category) => category.categoryId === categoryId)?.name.vi ?? "—";
}

export function attributesForProducts(products: readonly Product[]): ProductAttribute[] {
  const byId = new Map<string, ProductAttribute>();
  for (const product of products) {
    for (const attribute of product.attributes ?? []) {
      byId.set(attribute.attributeId, attribute);
    }
  }
  return Array.from(byId.values());
}

export function shouldFlagProductRow(product: Product): boolean {
  return (
    product.status === PRODUCT_STATUS.PENDING_APPROVAL ||
    product.status === PRODUCT_STATUS.DISCONTINUED
  );
}
