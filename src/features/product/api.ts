import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { productMasterDtoSchema, productSchema } from "./schemas";

import type { LegacyPaginatedResponse, PaginatedResponse } from "@/lib/api/query-factory";
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
  size?: number;
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
  action: "submit" | "approve" | "reject" | "discontinue";
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
  const { page = 0, size = 15, q, status, sort } = params;
  const query = new URLSearchParams({
    page: String(Math.max(0, page)),
    size: String(size),
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
  const { id, action, reason } = input;
  if (action === "reject" && !reason?.trim()) {
    throw new Error("Rejection reason is required");
  }
  const suffix = transitionSuffix(action);
  const { data } = await api.post<unknown>(
    `/v1/products/${id}/${suffix}`,
    suffix === "rejection" ? { reason: reason?.trim() } : undefined,
  );
  return parseProduct(data);
}

export async function publishProduct(id: string): Promise<void> {
  await api.post(`/v1/products/${id}/publication`);
}

export async function unpublishProduct(id: string): Promise<void> {
  await api.post(`/v1/products/${id}/unpublication`);
}

export async function listSkus(
  params: ListSkusParams,
  signal?: AbortSignal,
): Promise<LegacyPaginatedResponse<Sku>> {
  try {
    const { data } = await api.get<LegacyPaginatedResponse<Sku>>("/skus", { params, signal });
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

export async function listCategories(
  signal?: AbortSignal,
): Promise<LegacyPaginatedResponse<Category>> {
  try {
    const { data } = await api.get<LegacyPaginatedResponse<Category>>("/categories", { signal });
    return data;
  } catch (error: unknown) {
    // Backend gap (SCRUM-44): category persistence exists but there is no list endpoint yet.
    if (error instanceof ApiError && error.status === 404) return emptyPage();
    throw error;
  }
}

function emptyPage<T>(pageSize = 15): LegacyPaginatedResponse<T> {
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
    nameEn: dto.nameEn,
    type: dto.customizable ? "Customizable" : "Standard",
    categoryId: dto.categoryId ?? null,
    status,
    description: dto.description ?? "",
    descriptionEn: dto.descriptionEn ?? "",
    images: dto.images,
    taxClass: dto.taxClass.toLowerCase(),
    brand: dto.brand,
    createdAt: dto.createdAt,
    createdBy: dto.createdBy ?? "—",
    submittedBy: dto.submittedBy ?? undefined,
    submittedAt: dto.submittedAt ?? undefined,
    approvedBy: dto.approvedBy ?? undefined,
    approvedAt: dto.approvedAt ?? undefined,
    weightKg: dto.weightKg,
    lengthCm: dto.lengthCm,
    widthCm: dto.widthCm,
    heightCm: dto.heightCm,
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
