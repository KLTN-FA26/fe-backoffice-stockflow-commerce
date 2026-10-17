import { keepPreviousData, useQuery } from "@tanstack/react-query";

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

/** Thương hiệu đang dùng (BE PR #71 `GET /brands`) cho ô chọn trên form sản phẩm. */
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

/**
 * Chứng từ còn mở tham chiếu SKU của sản phẩm — tải khi mở hộp thoại ngừng kinh doanh để người dùng
 * thấy hậu quả trước khi xác nhận. Luôn lấy mới (`gcTime: 0`): đây là số liệu của các module khác.
 */
export function useOpenReferences(productId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: openReferencesKey(productId ?? ""),
    queryFn: ({ signal }) => getOpenReferences(productId ?? "", signal),
    enabled: Boolean(productId) && enabled,
    staleTime: 0,
    gcTime: 0,
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
