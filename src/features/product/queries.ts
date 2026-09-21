import { useQuery } from "@tanstack/react-query";

import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getProduct, getSku, listCategories, listProducts, listSkus } from "./api";

import type { Product, Sku } from "./types";
import type { ListProductsParams, ListSkusParams } from "./api";

export const productKeys = createQueryKeys<ListProductsParams>("products");
export const skuKeys = createQueryKeys<ListSkusParams>("skus");
export const categoryKeys = createQueryKeys<Record<string, unknown>>("categories");

export const useProducts = createListQuery<Product, ListProductsParams>(productKeys, listProducts);

export const useProduct = createDetailQuery<Product>(productKeys, getProduct);

export const useSkus = createListQuery<Sku, ListSkusParams>(skuKeys, listSkus);

export const useSku = createDetailQuery<Sku>(skuKeys, getSku);

export function useCategories(enabled: boolean | Record<string, unknown> = true) {
  return useQuery({
    queryKey: categoryKeys.list({}),
    queryFn: ({ signal }) => listCategories(signal),
    enabled: typeof enabled === "boolean" ? enabled : true,
  });
}
