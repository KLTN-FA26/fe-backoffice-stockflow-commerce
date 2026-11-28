/**
 * Kho sản phẩm của mock, dùng chung cho các file route mock (sản phẩm, trục / biến thể, giá & tồn
 * kho). Chỉ file mock được import `mock-data` — kho này tải seed theo yêu cầu.
 */

import { PRODUCT_PERMISSIONS } from "@/constants";

import { mockGrantsOf } from "./mock-user-grants";
import { findMockCategory } from "./mock-routes-taxonomy-store";

import type { Product } from "@/lib/mock-data";

/** `ProductResponse` của BE ngoài hình sản phẩm cũ của mock-data. */
export type MockProduct = Product & {
  brandId?: string | null;
  submittedBy?: string;
  /** Issue #286 — tên / cờ BE trả kèm, mock suy ra lúc trả (`withProductNames`), không lưu. */
  categoryName?: string;
  submittedByName?: string;
  approvedByName?: string;
  canApprove?: boolean;
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

/** Id dạng UUID (người dùng BE) — seed mock-data lại lưu thẳng họ tên ở `approvedBy` / `createdBy`. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tên người làm: họ tên `staffUsers` theo id; seed lưu sẵn họ tên thì dùng luôn; id lạ → không bịa tên. */
async function mockUserName(user: string | undefined): Promise<string | undefined> {
  if (!user) return undefined;
  const { staffUsers } = await import("@/lib/mock-data");
  const staff = staffUsers.find((s) => s.userId === user);
  if (staff) return staff.fullName;
  return UUID.test(user) ? undefined : user;
}

/**
 * BE `ProductResponse.canApprove` (issue #286): Chờ duyệt + `product-products:APPROVE` + không tự duyệt
 * (trừ người giữ `product-lifecycle:APPROVE`, BR-PRD-003). Người gọi không phải tài khoản demo (không
 * có bộ quyền mock) → bỏ trường, FE tự suy như với BE cũ.
 */
async function mockCanApprove(product: MockProduct): Promise<boolean | undefined> {
  const { useAuthStore } = await import("@/lib/auth/auth-store");
  const userId = useAuthStore.getState().user?.userId ?? "";
  const grants = mockGrantsOf(userId);
  if (grants.size === 0) return undefined;
  return (
    product.status === "Pending Approval" &&
    grants.has(PRODUCT_PERMISSIONS.approve) &&
    (product.submittedBy !== userId || grants.has(PRODUCT_PERMISSIONS.lifecycle))
  );
}

/**
 * Bản trả về của `ProductResponse` trong mock: thêm tên danh mục / người làm và `canApprove` suy từ dữ
 * liệu sẵn có (issue #286). Trường không suy được thì bỏ — như BE bỏ trường null (`NON_NULL`).
 */
export async function withProductNames(product: MockProduct): Promise<MockProduct> {
  const category = product.categoryId ? await findMockCategory(product.categoryId) : undefined;
  const [submittedByName, approvedByName, canApprove] = await Promise.all([
    mockUserName(product.submittedBy),
    mockUserName(product.approvedBy),
    mockCanApprove(product),
  ]);
  return {
    ...product,
    ...(category ? { categoryName: category.name } : {}),
    ...(submittedByName ? { submittedByName } : {}),
    ...(approvedByName ? { approvedByName } : {}),
    ...(canApprove === undefined ? {} : { canApprove }),
  };
}
