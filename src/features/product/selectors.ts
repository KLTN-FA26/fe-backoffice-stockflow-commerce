import { PRODUCT_STATUS, SKU_STATUS } from "@/constants";
import { formatVND } from "@/lib/format";

import type { Category, Product, ProductAttribute, ProductStatus, Sku, SkuStatus } from "./types";

export { formatVND as formatVnd };

export interface ProductListStats {
  totalProducts: number;
  activeProducts: number;
  publishedProducts: number;
  draftProducts: number;
  totalSkus: number;
  activeSkus: number;
  blockedSkus: number;
  obsoleteSkus: number;
  totalStockAvailable: number;
}

export interface SkuListStats {
  total: number;
  active: number;
  blocked: number;
  obsolete: number;
  totalStock: number;
  available: number;
  lowStock: number;
}

export function categoryName(categoryId: string | null, categories: readonly Category[]): string {
  if (categoryId === null) return "Chưa chọn danh mục";
  return categories.find((category) => category.categoryId === categoryId)?.name.vi ?? "—";
}

export function productUomLabel(product: Product): string {
  return product.uom ?? "Không có trong Product Master API";
}

export function productName(productId: string, products: readonly Product[]): string {
  return products.find((product) => product.productId === productId)?.name ?? "—";
}

export function skusForProduct(productId: string, skus: readonly Sku[]): Sku[] {
  return skus.filter((sku) => sku.productId === productId);
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

export function productSkuCount(productId: string, skus: readonly Sku[]): number {
  return skusForProduct(productId, skus).length;
}

export function productAvailableStock(productId: string, skus: readonly Sku[]): number {
  return skusForProduct(productId, skus).reduce((sum, sku) => sum + sku.stockAvailable, 0);
}

export function computeProductStats(
  products: readonly Product[],
  skus: readonly Sku[],
): ProductListStats {
  const productStatusCounts = countProductStatuses(products);
  const skuStatusCounts = countSkuStatuses(skus);

  return {
    totalProducts: products.length,
    activeProducts: productStatusCounts.Active ?? 0,
    publishedProducts: productStatusCounts.Published ?? 0,
    draftProducts: productStatusCounts.Draft ?? 0,
    totalSkus: skus.length,
    activeSkus: skuStatusCounts.Active ?? 0,
    blockedSkus: skuStatusCounts.Blocked ?? 0,
    obsoleteSkus: skuStatusCounts.Obsolete ?? 0,
    totalStockAvailable: skus.reduce((sum, sku) => sum + sku.stockAvailable, 0),
  };
}

export function computeSkuStats(skus: readonly Sku[]): SkuListStats {
  const skuStatusCounts = countSkuStatuses(skus);

  return {
    total: skus.length,
    active: skuStatusCounts.Active ?? 0,
    blocked: skuStatusCounts.Blocked ?? 0,
    obsolete: skuStatusCounts.Obsolete ?? 0,
    totalStock: skus.reduce((sum, sku) => sum + sku.stockOnHand, 0),
    available: skus.reduce((sum, sku) => sum + sku.stockAvailable, 0),
    lowStock: skus.filter((sku) => sku.stockAvailable <= sku.reorderPoint && sku.reorderPoint > 0)
      .length,
  };
}

export function countProductStatuses(
  products: readonly Product[],
): Partial<Record<ProductStatus, number>> {
  const counts: Partial<Record<ProductStatus, number>> = {};
  for (const product of products) {
    counts[product.status] = (counts[product.status] ?? 0) + 1;
  }
  return counts;
}

export function countSkuStatuses(skus: readonly Sku[]): Partial<Record<SkuStatus, number>> {
  const counts: Partial<Record<SkuStatus, number>> = {};
  for (const sku of skus) {
    counts[sku.status] = (counts[sku.status] ?? 0) + 1;
  }
  return counts;
}

export function shouldFlagProductRow(product: Product): boolean {
  return (
    product.status === PRODUCT_STATUS.PENDING_APPROVAL ||
    product.status === PRODUCT_STATUS.DISCONTINUED
  );
}

export function shouldFlagSkuRow(sku: Sku): boolean {
  return sku.status === SKU_STATUS.BLOCKED || sku.status === SKU_STATUS.OBSOLETE;
}
