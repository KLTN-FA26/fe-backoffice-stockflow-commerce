import { api } from "@/lib/api/client";

import { parseDiscontinuationExtras } from "./lifecycle-api";
import { parseProduct, parseProductPage } from "./product-parse";
import { discontinueProductSchema } from "./schemas";
import { listAllBrands, listAllCategoryNodes } from "./taxonomy-api";

import type { LegacyPaginatedResponse, PaginatedResponse } from "@/lib/api/query-factory";
import type { OpenReference } from "./lifecycle-schemas";
import type {
  BeCategoryDto,
  BrandDto,
  CreateProductInput,
  ProductMasterDto,
  UpdateProductInput,
} from "./schemas";
import type { Category, Product } from "./types";

export const PRODUCT_LIST_FILTER_STATUSES = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Published",
  "Inactive",
  "Discontinued",
] as const satisfies readonly Product["status"][];

export type ProductListFilterStatus = (typeof PRODUCT_LIST_FILTER_STATUSES)[number];

const PRODUCT_LIST_API_STATUS: Record<
  ProductListFilterStatus,
  Exclude<ProductMasterDto["status"], "UNKNOWN">
> = {
  Approved: "APPROVED",
  Discontinued: "DISCONTINUED",
  Draft: "DRAFT",
  "Pending Approval": "PENDING_APPROVAL",
  Published: "PUBLISHED",
  Inactive: "INACTIVE",
};

export interface ListProductsParams {
  page?: number;
  size?: number;
  q?: string;
  status?: ProductListFilterStatus[];
  sort?: string;
  [key: string]: unknown;
}

export interface TransitionProductInput {
  id: string;
  action: "submit" | "approve" | "reject";
  reason?: string;
}

/** Ngừng kinh doanh — BE `POST /products/{id}/discontinuation` cần `reason` + `version` của lần đọc trước. */
export interface DiscontinueProductInput {
  id: string;
  reason: string;
  version: number;
}

/**
 * Cảnh báo BE trả kèm (không phải lỗi — sản phẩm đã ngừng): PO / đơn hàng mở còn tham chiếu SKU của
 * nó (`warnings` là mã `OPEN_PURCHASE_ORDER_LINES` / `UNSHIPPED_ORDER_LINES`) và chính các chứng từ đó.
 */
export interface DiscontinueProductResult {
  product: Product;
  warnings: string[];
  openReferences: OpenReference[];
  openReferencesTruncated: boolean;
}

export async function listProducts(
  params: ListProductsParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Product>> {
  const { page = 0, size = 15, q, status, sort } = params;
  const query = new URLSearchParams({
    page: String(Math.max(0, page)),
    size: String(size),
  });
  if (q?.trim()) query.set("q", q.trim());
  for (const value of status ?? []) query.append("status", PRODUCT_LIST_API_STATUS[value]);
  if (sort?.trim()) query.set("sort", sort.trim());

  const { data } = await api.get<unknown>("/products", {
    params: query,
    signal,
  });
  return parseProductPage(data);
}

export async function getProduct(id: string, signal?: AbortSignal): Promise<Product> {
  const { data } = await api.get<unknown>(`/products/${id}`, {
    signal,
  });
  return parseProduct(data);
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const { data } = await api.post<unknown>("/products", productBody(input));
  return parseProduct(data);
}

/** BE `UpdateProductRequest.version` @NotNull: gửi `version` của lần đọc trước (409 OPTIMISTIC_LOCK nếu đã đổi). */
export async function updateProduct(input: { id: string } & UpdateProductInput): Promise<Product> {
  const { id, ...body } = input;
  const { data } = await api.put<unknown>(`/products/${id}`, productBody(body));
  return parseProduct(data);
}

/** Chuỗi rỗng → không gửi: BE lưu null thay vì "" cho các trường tuỳ chọn. */
function productBody<T extends Omit<UpdateProductInput, "version">>(input: T): T {
  return {
    ...input,
    shortDescription: input.shortDescription?.trim() || undefined,
    description: input.description.trim() || undefined,
    descriptionEn: input.descriptionEn.trim() || undefined,
  } as T;
}

export async function transitionProduct(input: TransitionProductInput): Promise<Product> {
  const { id, action, reason } = input;
  if (action === "reject" && !reason?.trim()) {
    throw new Error("Rejection reason is required");
  }
  const suffix = transitionSuffix(action);
  const { data } = await api.post<unknown>(
    `/products/${id}/${suffix}`,
    suffix === "rejection" ? { reason: reason?.trim() } : undefined,
  );
  return parseProduct(data);
}

export async function discontinueProduct(
  input: DiscontinueProductInput,
): Promise<DiscontinueProductResult> {
  const body = discontinueProductSchema.parse({ reason: input.reason, version: input.version });
  const { data } = await api.post<unknown>(`/products/${input.id}/discontinuation`, body);
  // `ProductDiscontinuationResponse`: các trường sản phẩm ở cấp trên cùng + cảnh báo + chứng từ còn mở.
  const extras = parseDiscontinuationExtras(data);
  return { product: parseProduct(data), ...extras };
}

export async function publishProduct(id: string): Promise<void> {
  await api.post(`/products/${id}/publication`);
}

export async function unpublishProduct(id: string): Promise<void> {
  await api.post(`/products/${id}/unpublication`);
}

/**
 * BE PR #71 `GET /categories` — MỌI danh mục (mọi cấp, tải hết các trang 200 dòng) theo thứ tự cây:
 * trang đầu một mình bỏ sót danh mục, ô chọn của form sản phẩm cần đủ cây. Gồm cả danh mục đã ngưng
 * (`active` = false, ngưng ở màn phân loại): sản phẩm cũ vẫn gắn và phải tra được tên — ô chọn chỉ mời
 * chọn danh mục đang dùng (ProductMasterSelects). Vượt mức chặn trang thì helper đã `console.warn`,
 * ô chọn chỉ dùng `rows`.
 */
export async function listCategories(
  signal?: AbortSignal,
): Promise<LegacyPaginatedResponse<Category>> {
  const { rows } = await listAllCategoryNodes({ sort: "path,asc" }, signal);
  const items = rows.map(toCategory);
  return { items, page: 1, pageSize: items.length, total: items.length };
}

/**
 * BE PR #71 `GET /brands` — MỌI thương hiệu (tải hết các trang), sắp theo tên; gồm cả thương hiệu đã
 * ngưng để tra tên cho sản phẩm cũ (ô chọn chỉ mời chọn cái đang dùng).
 */
export async function listBrands(signal?: AbortSignal): Promise<BrandDto[]> {
  const { rows } = await listAllBrands({ sort: "name,asc" }, signal);
  return rows;
}

/** BE chỉ có tên một ngôn ngữ cho danh mục; `level` = `depth` + 1 (cây tối đa 11 cấp). */
function toCategory(dto: BeCategoryDto): Category {
  return {
    categoryId: dto.categoryId,
    name: { vi: dto.name, en: dto.name },
    parentId: dto.parentId ?? null,
    level: dto.depth + 1,
    slug: dto.slug,
    active: dto.active,
  };
}

function transitionSuffix(action: TransitionProductInput["action"]): string {
  switch (action) {
    case "submit":
      return "submission";
    case "approve":
      return "approval";
    case "reject":
      return "rejection";
  }
}
