import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { productMasterDtoSchema, productSchema } from "./schemas";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { CreateProductInput, ProductMasterDto, UpdateProductInput } from "./schemas";
import type { Category, Product, Sku } from "./types";

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
  pageSize?: number;
  q?: string;
  status?: ProductListFilterStatus[];
  sort?: string;
  [key: string]: unknown;
}

export interface ListSkusParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string[];
  productId?: string;
  sort?: string;
  [key: string]: unknown;
}

export interface TransitionProductInput {
  id: string;
  targetStatus: string;
  reason?: string;
}

export interface TransitionSkuInput {
  id: string;
  targetStatus: string;
  reason?: string;
}

export async function listProducts(
  params: ListProductsParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Product>> {
  const { page = 1, pageSize = 15, q, status, sort } = params;
  const query = new URLSearchParams({
    page: String(Math.max(0, page - 1)),
    size: String(pageSize),
  });
  if (q?.trim()) query.set("q", q.trim());
  for (const value of status ?? []) query.append("status", PRODUCT_LIST_API_STATUS[value]);
  if (sort?.trim()) query.set("sort", sort.trim());

  const { data } = await api.get<unknown>("/v1/products", {
    params: query,
    signal,
  });
  return parseProductPage(data);
}

export async function getProduct(id: string, signal?: AbortSignal): Promise<Product> {
  const { data } = await api.get<unknown>(`/v1/products/${id}`, {
    signal,
  });
  return parseProduct(data);
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const { data } = await api.post<unknown>("/v1/products", input);
  return parseProduct(data);
}

export async function updateProduct(input: { id: string } & UpdateProductInput): Promise<Product> {
  const { id, ...body } = input;
  const { data } = await api.put<unknown>(`/v1/products/${id}`, body);
  return parseProduct(data);
}

export async function transitionProduct(input: TransitionProductInput): Promise<Product> {
  const { id, targetStatus, reason } = input;
  const suffix = transitionSuffix(targetStatus);
  const { data } = await api.post<unknown>(
    `/v1/products/${id}/${suffix}`,
    suffix === "rejection" ? { reason } : undefined,
  );
  return parseProduct(data);
}

export async function listSkus(
  params: ListSkusParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Sku>> {
  try {
    const { data } = await api.get<PaginatedResponse<Sku>>("/skus", { params, signal });
    return data;
  } catch (error: unknown) {
    // Backend gap (SCRUM-44): no SKU read API exists yet. Keep Product master usable without
    // presenting that missing adjacent resource as a Product load failure.
    if (error instanceof ApiError && error.status === 404) return emptyPage(params.pageSize);
    throw error;
  }
}

export async function getSku(id: string, signal?: AbortSignal): Promise<Sku> {
  const { data } = await api.get<Sku>(`/skus/${id}`, {
    signal,
  });
  return data;
}

export async function transitionSku(input: TransitionSkuInput): Promise<Sku> {
  const { id, ...body } = input;
  const { data } = await api.patch<Sku>(`/skus/${id}/status`, body);
  return data;
}

export async function listCategories(signal?: AbortSignal): Promise<PaginatedResponse<Category>> {
  try {
    const { data } = await api.get<PaginatedResponse<Category>>("/categories", { signal });
    return data;
  } catch (error: unknown) {
    // Backend gap (SCRUM-44): category persistence exists but there is no list endpoint yet.
    if (error instanceof ApiError && error.status === 404) return emptyPage();
    throw error;
  }
}

function emptyPage<T>(pageSize = 15): PaginatedResponse<T> {
  return { items: [], page: 1, pageSize, total: 0 };
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
    page: typeof page.page === "number" ? page.page + ("size" in page ? 1 : 0) : 1,
    pageSize:
      typeof page.size === "number"
        ? page.size
        : typeof page.pageSize === "number"
          ? page.pageSize
          : items.length,
    total:
      typeof page.totalElements === "number"
        ? page.totalElements
        : typeof page.total === "number"
          ? page.total
          : items.length,
    totalPages: typeof page.totalPages === "number" ? page.totalPages : undefined,
    hasNext: typeof page.hasNext === "boolean" ? page.hasNext : undefined,
    hasPrevious: typeof page.hasPrevious === "boolean" ? page.hasPrevious : undefined,
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
    nameEn: dto.nameEn,
    slug: dto.code.toLowerCase(),
    type: dto.customizable ? "Customizable" : "Standard",
    categoryId: dto.categoryId ?? null,
    status,
    description: dto.description ?? "",
    descriptionEn: dto.descriptionEn ?? "",
    images: dto.images,
    basePrice: 0,
    attributes: [],
    taxClass: dto.taxClass.toLowerCase(),
    uom: "pcs",
    brand: dto.brand,
    createdAt: dto.createdAt,
    createdBy: dto.createdBy ?? "—",
    approvedBy: dto.approvedBy ?? undefined,
    approvedAt: dto.approvedAt ?? undefined,
    weightKg: dto.weightKg,
    lengthCm: dto.lengthCm,
    widthCm: dto.widthCm,
    heightCm: dto.heightCm,
  });
}

function transitionSuffix(targetStatus: string): string {
  switch (targetStatus) {
    case "Pending Approval":
      return "submission";
    case "Approved":
      return "approval";
    case "Draft":
      return "rejection";
    case "Discontinued":
      return "discontinuation";
    default:
      throw new Error(`Backend does not implement transition to ${targetStatus}`);
  }
}
