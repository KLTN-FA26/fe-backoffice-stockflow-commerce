import { api } from "@/lib/api/client";

import { PAGE_SIZE } from "@/constants";

import { beBrandSchema, beCategorySchema, productMasterDtoSchema, productSchema } from "./schemas";

import type { LegacyPaginatedResponse, PaginatedResponse } from "@/lib/api/query-factory";
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
  "Discontinued",
] as const satisfies readonly Product["status"][];

export type ProductListFilterStatus = (typeof PRODUCT_LIST_FILTER_STATUSES)[number];

const PRODUCT_LIST_API_STATUS: Record<ProductListFilterStatus, ProductMasterDto["status"]> = {
  Approved: "APPROVED",
  Discontinued: "DISCONTINUED",
  Draft: "DRAFT",
  "Pending Approval": "PENDING_APPROVAL",
  Published: "PUBLISHED",
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
  action: "submit" | "approve" | "reject" | "discontinue";
  reason?: string;
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

export async function updateProduct(input: { id: string } & UpdateProductInput): Promise<Product> {
  const { id, ...body } = input;
  const { data } = await api.put<unknown>(`/products/${id}`, productBody(body));
  return parseProduct(data);
}

/** Chuỗi rỗng → không gửi: BE lưu null thay vì "" cho các trường tuỳ chọn. */
function productBody<T extends UpdateProductInput>(input: T): T {
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

export async function publishProduct(id: string): Promise<void> {
  await api.post(`/products/${id}/publication`);
}

export async function unpublishProduct(id: string): Promise<void> {
  await api.post(`/products/${id}/unpublication`);
}

/** BE PR #71 `GET /categories` — PageResponse<CategoryResponse>, chỉ danh mục đang dùng. */
export async function listCategories(
  signal?: AbortSignal,
): Promise<LegacyPaginatedResponse<Category>> {
  const params = new URLSearchParams({
    active: "true",
    size: String(PAGE_SIZE.masterData),
    sort: "path,asc",
  });
  const { data } = await api.get<unknown>("/categories", { params, signal });
  const items = beItems(data).map((row) => toCategory(beCategorySchema.parse(row)));
  return { items, page: 1, pageSize: items.length, total: items.length };
}

/** BE PR #71 `GET /brands` — thương hiệu đang dùng, sắp theo tên. */
export async function listBrands(signal?: AbortSignal): Promise<BrandDto[]> {
  const params = new URLSearchParams({
    active: "true",
    size: String(PAGE_SIZE.masterData),
    sort: "name,asc",
  });
  const { data } = await api.get<unknown>("/brands", { params, signal });
  return beItems(data).map((row) => beBrandSchema.parse(row));
}

function beItems(page: unknown): unknown[] {
  if (
    typeof page !== "object" ||
    page === null ||
    !Array.isArray((page as { items?: unknown }).items)
  ) {
    throw new Error("Page response is malformed");
  }
  return (page as { items: unknown[] }).items;
}

/** BE chỉ có tên một ngôn ngữ cho danh mục; cây sâu hơn 3 cấp hiển thị như cấp 3. */
function toCategory(dto: BeCategoryDto): Category {
  return {
    categoryId: dto.categoryId,
    name: { vi: dto.name, en: dto.name },
    parentId: dto.parentId ?? null,
    level: Math.min(3, dto.depth + 1) as Category["level"],
    slug: dto.slug,
  };
}

function parseProduct(value: unknown): Product {
  const legacy = productSchema.safeParse(value);
  if (legacy.success) return legacy.data;
  return toProduct(productMasterDtoSchema.parse(value));
}

function parseProductPage(value: unknown): PaginatedResponse<Product> {
  if (typeof value !== "object" || value === null || !("items" in value)) {
    throw new Error("Product page response is malformed");
  }
  const page = value as Record<string, unknown>;
  const items = Array.isArray(page.items) ? page.items.map(parseProduct) : [];
  return {
    items,
    page: requireNumber(page.page, "page"),
    size: requireNumber(page.size, "size"),
    totalElements: requireNumber(page.totalElements, "totalElements"),
    totalPages: requireNumber(page.totalPages, "totalPages"),
    hasNext: requireBoolean(page.hasNext, "hasNext"),
    hasPrevious: requireBoolean(page.hasPrevious, "hasPrevious"),
  };
}

function toProduct(dto: ProductMasterDto): Product {
  const status = {
    APPROVED: "Approved",
    DISCONTINUED: "Discontinued",
    DRAFT: "Draft",
    PENDING_APPROVAL: "Pending Approval",
    PUBLISHED: "Published",
  }[dto.status] as Product["status"];

  return productSchema.parse({
    productId: dto.productId,
    code: dto.code,
    name: dto.name,
    nameEn: dto.nameEn || dto.name,
    // Chỉ khi BE có slug — không bịa slug từ tên.
    ...(dto.slug ? { slug: dto.slug } : {}),
    type: dto.kind === "CUSTOMIZABLE" ? "Customizable" : "Standard",
    categoryId: dto.categoryId ?? null,
    status,
    shortDescription: dto.shortDescription ?? undefined,
    description: dto.description ?? "",
    descriptionEn: dto.descriptionEn ?? "",
    // BE PR #71: ảnh thuộc biến thể (`/variants/{id}/media`), không còn trên dòng sản phẩm.
    images: [],
    taxClass: dto.taxClass.toLowerCase(),
    brand: dto.brandName ?? "",
    brandId: dto.brandId ?? null,
    rejectionReason: dto.rejectionReason ?? undefined,
    createdAt: dto.createdAt,
    createdBy: dto.createdBy ?? "—",
    submittedBy: dto.submittedBy ?? undefined,
    submittedAt: dto.submittedAt ?? undefined,
    approvedBy: dto.approvedBy ?? undefined,
    approvedAt: dto.approvedAt ?? undefined,
  });
}

function transitionSuffix(action: TransitionProductInput["action"]): string {
  switch (action) {
    case "submit":
      return "submission";
    case "approve":
      return "approval";
    case "reject":
      return "rejection";
    case "discontinue":
      return "discontinuation";
  }
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number") throw new Error(`Product page ${field} is malformed`);
  return value;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Product page ${field} is malformed`);
  return value;
}
