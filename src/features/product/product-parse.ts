import { PRODUCT_STATUS } from "@/constants";

import { productMasterDtoSchema, productSchema } from "./schemas";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { ProductMasterDto } from "./schemas";
import type { Product } from "./types";

export function parseProduct(value: unknown): Product {
  const legacy = productSchema.safeParse(value);
  if (legacy.success) return legacy.data;
  return toProduct(productMasterDtoSchema.parse(value));
}

export function parseProductPage(value: unknown): PaginatedResponse<Product> {
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
  const status: Product["status"] = {
    APPROVED: PRODUCT_STATUS.APPROVED,
    DISCONTINUED: PRODUCT_STATUS.DISCONTINUED,
    DRAFT: PRODUCT_STATUS.DRAFT,
    INACTIVE: PRODUCT_STATUS.INACTIVE,
    PENDING_APPROVAL: PRODUCT_STATUS.PENDING_APPROVAL,
    PUBLISHED: PRODUCT_STATUS.PUBLISHED,
    UNKNOWN: PRODUCT_STATUS.UNKNOWN,
  }[dto.status];

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
    version: dto.version,
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
    suspendedAt: dto.suspendedAt ?? undefined,
    suspendReason: dto.suspendReason ?? undefined,
    discontinuedAt: dto.discontinuedAt ?? undefined,
    discontinueReason: dto.discontinueReason ?? undefined,
  });
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number") throw new Error(`Product page ${field} is malformed`);
  return value;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Product page ${field} is malformed`);
  return value;
}
