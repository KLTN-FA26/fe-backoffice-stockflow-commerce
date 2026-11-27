/**
 * Chọn quy cách của danh mục (biến thể không phải SKU riêng của khách) — dùng ở màn giá chuẩn (kltn-docs 13 BR-04 sửa
 * ngày 2026-11-26). Đọc hai API quản trị sản phẩm có sẵn: `GET /products?q=` (`product-products:READ`) và
 * `GET /products/{id}/variants` (`product-variants:READ`). Đặt ở `lib/` để feature giá chuẩn không import
 * `features/product` (feature-architecture); schema chỉ giữ đúng trường cần cho ô chọn.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { COMBOBOX_MAX_ROWS } from "@/constants";
import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";

/**
 * SKU riêng của khách (docs 01 §4.8): BE trả chung danh sách biến thể của sản phẩm nhưng `VariantResponse` không có
 * `ownerCustomerId` — nhận diện qua chữ ký BE `CustomerSkuService` đặt khi sinh SKU (`OWNED-SKU:<sku>`).
 * ASSUMPTION: đổi khi BE thêm cờ riêng.
 */
export const CUSTOMER_SKU_SIGNATURE_PREFIX = "OWNED-SKU:";
export const isCustomerOwnedSku = (variant: { attributeSignature?: string | null }): boolean =>
  variant.attributeSignature?.startsWith(CUSTOMER_SKU_SIGNATURE_PREFIX) ?? false;

/** Số sản phẩm mỗi lần tìm — bằng số dòng tối đa của ô chọn (`COMBOBOX_MAX_ROWS`); còn nữa thì nhắc gõ thêm. */
const PRODUCT_OPTIONS_PAGE_SIZE = COMBOBOX_MAX_ROWS;
/** BE giới hạn trang 200 (`Pages.MAX_PAGE_SIZE`); một trang là đủ cho ô chọn quy cách. */
const VARIANT_PAGE_SIZE = 200;

const productOptionSchema = z.object({
  productId: z.string().min(1),
  code: z.string().nullish(),
  name: z.string(),
});
export type ProductOption = z.infer<typeof productOptionSchema>;

const productOptionPageSchema = z.object({
  items: z.array(productOptionSchema),
  totalElements: z.number().int().min(0).optional(),
});

/** Một lần tìm sản phẩm: trang đầu + tổng số khớp (để báo "Còn N kết quả — gõ thêm"). */
export interface ProductOptionPage {
  items: ProductOption[];
  total: number;
}

const catalogVariantSchema = z.object({
  variantId: z.string(),
  sku: z.string(),
  name: z.string(),
  status: z.string(),
  attributeSignature: z.string().nullish(),
});
export type CatalogVariant = z.infer<typeof catalogVariantSchema>;

const variantPageSchema = z.object({ items: z.array(catalogVariantSchema) });

export const catalogVariantKeys = {
  all: ["catalog-variant-options"] as const,
  products: (q: string) => [...catalogVariantKeys.all, "products", q] as const,
  variants: (productId: string) => [...catalogVariantKeys.all, "variants", productId] as const,
};

export async function fetchProductOptions(
  q: string,
  signal?: AbortSignal,
): Promise<ProductOptionPage> {
  const params = new URLSearchParams({ page: "0", size: String(PRODUCT_OPTIONS_PAGE_SIZE) });
  if (q.trim()) params.set("q", q.trim());
  const { data } = await api.get<unknown>("/products", { params, signal });
  const page = productOptionPageSchema.parse(data);
  return { items: page.items, total: page.totalElements ?? page.items.length };
}

/**
 * Quy cách của danh mục của một sản phẩm: bỏ SKU riêng của khách (giá chuẩn chỉ đặt cho quy cách — BE
 * `STANDARD_PRICE_VARIANT_REQUIRED`) và quy cách đã ngừng (`OBSOLETE`).
 */
export async function fetchCatalogVariants(productId: string, signal?: AbortSignal) {
  const { data } = await api.get<unknown>(`/products/${encodeURIComponent(productId)}/variants`, {
    params: { page: 0, size: VARIANT_PAGE_SIZE },
    signal,
  });
  return variantPageSchema
    .parse(data)
    .items.filter((v) => !isCustomerOwnedSku(v) && v.status !== "OBSOLETE");
}

/** `q` đã debounce ở component; giữ kết quả cũ khi đang gõ để danh sách không nháy rỗng. */
export function useProductOptions(q: string, enabled: boolean) {
  const term = q.trim();
  return useQuery({
    queryKey: catalogVariantKeys.products(term),
    queryFn: ({ signal }) => fetchProductOptions(term, signal),
    enabled,
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.list,
  });
}

export function useCatalogVariants(productId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: catalogVariantKeys.variants(productId ?? ""),
    queryFn: ({ signal }) => fetchCatalogVariants(productId ?? "", signal),
    enabled: enabled && !!productId,
    ...QUERY_TIMES.master,
  });
}
