import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getProduct, listBrands, listCategories, listProducts } from "./api";
import { getOpenReferences, listProductVersions } from "./lifecycle-api";

import type { Product } from "./types";
import type { ListProductsParams } from "./api";

export const productKeys = createQueryKeys<ListProductsParams>("products");
export const categoryKeys = createQueryKeys<Record<string, unknown>>("categories");
export const brandKeys = createQueryKeys<Record<string, unknown>>("brands");

export const useProducts = createListQuery<Product, ListProductsParams>(productKeys, listProducts);

export const useProduct = createDetailQuery<Product>(productKeys, getProduct);

export function useCategories(enabled: boolean | Record<string, unknown> = true) {
  return useQuery({
    queryKey: categoryKeys.list({}),
    queryFn: ({ signal }) => listCategories(signal),
    enabled: typeof enabled === "boolean" ? enabled : true,
  });
}

/** Mọi thương hiệu, kể cả đã ngưng (BE PR #71 `GET /brands`) — ô chọn tự lọc cái đang dùng. */
export function useBrands(enabled = true) {
  return useQuery({
    queryKey: brandKeys.list({}),
    queryFn: ({ signal }) => listBrands(signal),
    enabled,
  });
}

/** Gốc khoá lịch sử thay đổi: mọi mutation sửa sản phẩm / biến thể / SKU làm mới nó. */
export const PRODUCT_HISTORY_ROOT = ["products", "history"] as const;
const openReferencesKey = (productId: string) =>
  ["products", "open-references", productId] as const;

export interface OpenReferencesOptions {
  /**
   * Thẻ "Chứng từ còn mở" luôn hiện ở trang chi tiết: dùng lại dữ liệu trong `QUERY_TIMES.detail`,
   * không tải lại mỗi lần quay về tab — BE quét đơn mua lẫn đơn bán theo từng SKU nên truy vấn nặng.
   */
  cached?: boolean;
}

/** Mặc định (hộp thoại ngừng kinh doanh): luôn lấy mới khi mở — số liệu của module khác. */
const ALWAYS_FRESH = { staleTime: 0, gcTime: 0 } as const;
const CARD_FRESHNESS = { ...QUERY_TIMES.detail, refetchOnWindowFocus: false } as const;

/**
 * Chứng từ còn mở tham chiếu SKU của sản phẩm. Hộp thoại ngừng kinh doanh (mặc định) đứng trước một
 * thao tác không hoàn tác nên luôn tải lại khi mở, kể cả khi thẻ cột phải vừa tải (cùng khoá — dữ liệu
 * mới cũng cập nhật thẻ); thẻ truyền `{ cached: true }`.
 */
export function useOpenReferences(
  productId: string | undefined,
  enabled = true,
  { cached = false }: OpenReferencesOptions = {},
) {
  return useQuery({
    queryKey: openReferencesKey(productId ?? ""),
    queryFn: ({ signal }) => getOpenReferences(productId ?? "", signal),
    enabled: Boolean(productId) && enabled,
    ...(cached ? CARD_FRESHNESS : ALWAYS_FRESH),
  });
}

/** Lịch sử thay đổi (BE `GET /products/{id}/versions`, phân trang, mới nhất trước). */
export function useProductVersions(productId: string | undefined, page: number, size: number) {
  return useQuery({
    queryKey: [...PRODUCT_HISTORY_ROOT, productId ?? "", page, size] as const,
    queryFn: ({ signal }) => listProductVersions(productId ?? "", { page, size }, signal),
    enabled: Boolean(productId),
    placeholderData: keepPreviousData,
  });
}
