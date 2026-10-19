/**
 * API thương hiệu / danh mục cho màn quản lý (BE `ProductTaxonomyController`). Parse zod tại biên.
 * Dropdown của form sản phẩm vẫn đọc qua `listBrands` / `listCategories` trong `api.ts`; `listAll*`
 * phục vụ cây danh mục và ô chọn danh mục cha của màn này.
 */
import { PAGE_SIZE, TAXONOMY_LIMITS } from "@/constants";
import { api } from "@/lib/api/client";

import { inTreeOrder } from "./category-tree";
import {
  beBrandPageSchema,
  beBrandSchema,
  beCategoryPageSchema,
  beCategorySchema,
} from "./taxonomy-schemas";
import {
  toBrandCreateRequest,
  toBrandUpdateRequest,
  toCategoryCreateRequest,
  toCategoryUpdateRequest,
} from "./taxonomy-input-schemas";

import type { Brand, BrandPage, CategoryNode, CategoryNodePage } from "./taxonomy-schemas";
import type { BrandFormValues, CategoryFormValues } from "./taxonomy-input-schemas";

const enc = encodeURIComponent;
const BRANDS_PATH = "/brands";
const CATEGORIES_PATH = "/categories";

export interface BrandListParams {
  /** Trang đánh số từ 0; `size` tối đa 200 (`Pages.MAX_PAGE_SIZE`, vượt → 400). */
  page?: number;
  size?: number;
  /** Khớp `name` hoặc `code` (contains, không phân biệt hoa thường). */
  q?: string;
  active?: boolean;
  /** Whitelist BE: `name`, `code`, `createdAt` — dạng `field,asc`. */
  sort?: string;
  [key: string]: unknown;
}

export interface CategoryListParams extends BrandListParams {
  /** true = chỉ danh mục gốc. Không truyền cả `roots` lẫn `parentId` = mọi danh mục. */
  roots?: boolean;
  /** Con trực tiếp của danh mục này. */
  parentId?: string;
  /** Whitelist BE: `path` (thứ tự cây — mặc định), `name`, `code`, `sortOrder`, `createdAt`. */
  sort?: string;
}

export async function listBrandPage(
  params: BrandListParams,
  signal?: AbortSignal,
): Promise<BrandPage> {
  const { data } = await api.get<unknown>(BRANDS_PATH, {
    params: {
      page: params.page,
      size: params.size,
      q: params.q || undefined,
      active: params.active,
      sort: params.sort,
    },
    signal,
  });
  return beBrandPageSchema.parse(data);
}

export async function createBrand(values: BrandFormValues): Promise<Brand> {
  const { data } = await api.post<unknown>(BRANDS_PATH, toBrandCreateRequest(values));
  return beBrandSchema.parse(data);
}

export async function updateBrand(input: {
  brandId: string;
  values: BrandFormValues;
}): Promise<Brand> {
  const { data } = await api.put<unknown>(
    `${BRANDS_PATH}/${enc(input.brandId)}`,
    toBrandUpdateRequest(input.values),
  );
  return beBrandSchema.parse(data);
}

export async function listCategoryPage(
  params: CategoryListParams,
  signal?: AbortSignal,
): Promise<CategoryNodePage> {
  const { data } = await api.get<unknown>(CATEGORIES_PATH, {
    params: {
      page: params.page,
      size: params.size,
      q: params.q || undefined,
      roots: params.roots || undefined,
      parentId: params.parentId,
      active: params.active,
      sort: params.sort,
    },
    signal,
  });
  return beCategoryPageSchema.parse(data);
}

export async function createCategory(values: CategoryFormValues): Promise<CategoryNode> {
  const { data } = await api.post<unknown>(CATEGORIES_PATH, toCategoryCreateRequest(values));
  return beCategorySchema.parse(data);
}

export async function updateCategory(input: {
  categoryId: string;
  values: CategoryFormValues;
}): Promise<CategoryNode> {
  const { data } = await api.put<unknown>(
    `${CATEGORIES_PATH}/${enc(input.categoryId)}`,
    toCategoryUpdateRequest(input.values),
  );
  return beCategorySchema.parse(data);
}

/**
 * Tải mọi trang cho ô chọn / cây: trang đầu cho biết `totalPages`, các trang còn lại tải song song
 * (không chờ nối tiếp). Các trang không cùng một snapshot — bản ghi thêm / ngưng giữa hai request
 * làm lệch offset → khử trùng theo id để ô chọn không lặp option (trùng `key`).
 */
async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; hasNext: boolean; totalPages: number }>,
  idOf: (row: T) => string,
): Promise<T[]> {
  const first = await fetchPage(0);
  const pageCount = first.hasNext ? Math.min(first.totalPages, TAXONOMY_LIMITS.maxLookupPages) : 1;
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) => fetchPage(i + 1)),
  );
  const byId = new Map<string, T>();
  for (const row of [first, ...rest].flatMap((p) => p.items)) {
    if (!byId.has(idOf(row))) byId.set(idOf(row), row);
  }
  return [...byId.values()];
}

type LookupParams = Pick<BrandListParams, "q" | "active" | "sort">;

export async function listAllBrands(params: LookupParams, signal?: AbortSignal): Promise<Brand[]> {
  return fetchAllPages(
    (page) => listBrandPage({ ...params, page, size: PAGE_SIZE.masterData }, signal),
    (brand) => brand.brandId,
  );
}

/** Mọi danh mục theo thứ tự cây (`inTreeOrder` — không tin thứ tự chuỗi `path` của BE). */
export async function listAllCategoryNodes(
  params: LookupParams,
  signal?: AbortSignal,
): Promise<CategoryNode[]> {
  const rows = await fetchAllPages(
    (page) => listCategoryPage({ ...params, page, size: PAGE_SIZE.masterData }, signal),
    (category) => category.categoryId,
  );
  return inTreeOrder(rows);
}
