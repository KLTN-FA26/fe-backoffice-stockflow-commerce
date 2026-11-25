/**
 * Query giá chuẩn. SKU trong khoá được chuẩn hoá như BE (bỏ khoảng trắng, in hoa) để chi tiết và danh sách khớp nhau.
 */
import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";

import { getStandardPrice, listStandardPrices } from "./api";

const normalizeSku = (sku: string) => sku.trim().toUpperCase();

export const standardPriceKeys = {
  all: ["standard-prices"] as const,
  lists: () => [...standardPriceKeys.all, "list"] as const,
  /** Bộ lọc SKU sắp lại + bỏ trùng: cùng bộ SKU thì cùng khoá dù thứ tự khác. */
  list: (skus: readonly string[] = []) =>
    [...standardPriceKeys.lists(), [...new Set(skus.map(normalizeSku))].sort()] as const,
  detail: (sku: string) => [...standardPriceKeys.all, "detail", normalizeSku(sku)] as const,
};

/** Mọi giá chuẩn (mảng, không phân trang). `canRead` = `catalog-standard-prices:READ` (UI-only — BE re-check). */
export function useStandardPrices(canRead: boolean, skus: readonly string[] = []) {
  return useQuery({
    queryKey: standardPriceKeys.list(skus),
    queryFn: ({ signal }) => listStandardPrices(skus, signal),
    enabled: canRead,
    ...QUERY_TIMES.list,
  });
}

/** Giá chuẩn của một quy cách; 404 STANDARD_PRICE_NOT_FOUND là lỗi (không bịa bảng giá rỗng). */
export function useStandardPrice(sku: string | null | undefined, canRead: boolean) {
  return useQuery({
    queryKey: standardPriceKeys.detail(sku ?? ""),
    queryFn: ({ signal }) => getStandardPrice(sku ?? "", signal),
    enabled: Boolean(sku) && canRead,
    ...QUERY_TIMES.detail,
  });
}
