/**
 * Kho sản phẩm của mock, dùng chung cho các file route mock (sản phẩm, trục / biến thể, giá & tồn
 * kho). Chỉ file mock được import `mock-data` — kho này tải seed theo yêu cầu.
 */

import type { Product } from "@/lib/mock-data";

/** `ProductResponse` của BE ngoài hình sản phẩm cũ của mock-data. */
export type MockProduct = Product & {
  brandId?: string | null;
  shortDescription?: string;
  /** BE `ProductResponse.version`: bản ghi seed bắt đầu từ 0, mỗi lần ghi tăng 1. */
  version?: number;
  suspendedAt?: string;
  suspendReason?: string;
  discontinuedAt?: string;
  discontinueReason?: string;
};

export const createdProducts: MockProduct[] = [];
export const productOverrides = new Map<string, MockProduct>();
/** Sản phẩm bị xoá (`DELETE /products/{id}`) — kể cả bản ghi seed. */
const deletedProductIds = new Set<string>();

export async function allMockProducts(): Promise<MockProduct[]> {
  const { products } = await import("@/lib/mock-data");
  return [...products, ...createdProducts]
    .filter((product) => !deletedProductIds.has(product.productId))
    .map((product) => productOverrides.get(product.productId) ?? product);
}

export async function findMockProduct(id: string): Promise<MockProduct | undefined> {
  return (await allMockProducts()).find((product) => product.productId === id);
}

export function saveMockProduct(product: MockProduct): void {
  productOverrides.set(product.productId, product);
}

export function deleteMockProduct(id: string): void {
  deletedProductIds.add(id);
  productOverrides.delete(id);
  const index = createdProducts.findIndex((product) => product.productId === id);
  if (index >= 0) createdProducts.splice(index, 1);
}

export function resetProductMockStore(): void {
  createdProducts.length = 0;
  productOverrides.clear();
  deletedProductIds.clear();
}

/** BE `Product.acceptsChanges`: không sửa khi đang chờ duyệt hoặc đã ngừng kinh doanh. */
export const mockProductAcceptsChanges = (product: MockProduct): boolean =>
  product.status !== "Pending Approval" && product.status !== "Discontinued";
