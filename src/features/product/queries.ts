import { useQuery } from "@tanstack/react-query";

import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getProduct, listBrands, listCategories, listProducts } from "./api";

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
