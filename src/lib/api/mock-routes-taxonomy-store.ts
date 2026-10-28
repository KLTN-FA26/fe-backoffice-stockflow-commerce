/**
 * Store mock thương hiệu / danh mục — hình dữ liệu đúng bảng `product.brands`, `product.categories`
 * (BE migration V20260928001000). Route sản phẩm và bộ gợi ý theo danh mục cũng đọc store này để
 * thương hiệu / danh mục vừa tạo trên màn quản lý dùng được ngay.
 */

export interface MockBrand {
  brandId: string;
  code: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  active: boolean;
  version: number;
  createdAt: string;
}

export interface MockCategory {
  categoryId: string;
  parentId: string | null;
  code: string;
  name: string;
  slug: string;
  /** `/GOC/CON` — mã các cấp nối bằng '/'. */
  path: string;
  /** 0 là gốc, tối đa 10 (CHECK `ck_categories_depth`). */
  depth: number;
  sortOrder: number;
  imageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  active: boolean;
  version: number;
  createdAt: string;
}

const SEED_CREATED_AT = "2026-09-28T00:00:00.000Z";

/** ASSUMPTION: thương hiệu theo tên `brand` của sản phẩm trong mock-data (mock-data không có bảng thương hiệu). */
const SEED_BRANDS = [
  { brandId: "BRD-SFB", code: "SFB", name: "StockFlow Basics" },
  { brandId: "BRD-GILDAN", code: "GILDAN", name: "Gildan" },
];

let brands: MockBrand[] | null = null;
let categories: MockCategory[] | null = null;

export function resetTaxonomyMockStore(): void {
  brands = null;
  categories = null;
}

/** `Slugs.of`: in thường, mỗi chuỗi ký tự ngoài `[a-z0-9]` thành '-', bỏ '-' đầu / cuối. */
export const slugOf = (code: string) =>
  code
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function brandStore(): MockBrand[] {
  brands ??= SEED_BRANDS.map((b) => ({
    ...b,
    slug: slugOf(b.code),
    logoUrl: null,
    active: true,
    version: 0,
    createdAt: SEED_CREATED_AT,
  }));
  return brands;
}

export const findMockBrand = (brandId: string) => brandStore().find((b) => b.brandId === brandId);

export async function categoryStore(): Promise<MockCategory[]> {
  if (categories) return categories;
  const seed = (await import("@/lib/mock-data")).categories;
  const pathOf = (id: string | null): string => {
    const node = seed.find((c) => c.categoryId === id);
    return node ? `${pathOf(node.parentId)}/${node.categoryId}` : "";
  };
  // ASSUMPTION: mã danh mục = `categoryId` của mock-data (hợp CHECK `ck_categories_code`)
  categories = seed.map((c, index) => ({
    categoryId: c.categoryId,
    parentId: c.parentId,
    code: c.categoryId,
    name: c.name.vi,
    slug: slugOf(c.categoryId),
    path: pathOf(c.categoryId),
    depth: c.level - 1,
    sortOrder: index,
    imageUrl: null,
    seoTitle: null,
    seoDescription: null,
    active: true,
    version: 0,
    createdAt: SEED_CREATED_AT,
  }));
  return categories;
}

export async function findMockCategory(categoryId: string): Promise<MockCategory | undefined> {
  return (await categoryStore()).find((c) => c.categoryId === categoryId);
}
