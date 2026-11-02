/**
 * Query bảng giá khách hàng. Khoá theo từng khách: ghi giá của một khách chỉ làm mới khách đó.
 * SKU trong khoá được chuẩn hoá như BE (bỏ khoảng trắng, in hoa) để chi tiết và danh sách khớp nhau.
 */
import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";

import { getCustomerPrice, listCustomerPrices } from "./api";

const normalizeSku = (sku: string) => sku.trim().toUpperCase();

export const customerPriceKeys = {
  all: ["customer-prices"] as const,
  /** Mọi query của một khách — danh sách lẫn chi tiết. */
  customer: (customerId: string) => [...customerPriceKeys.all, customerId] as const,
  lists: (customerId: string) => [...customerPriceKeys.customer(customerId), "list"] as const,
  /** Bộ lọc SKU sắp lại + bỏ trùng: cùng bộ SKU thì cùng khoá dù thứ tự khác. */
  list: (customerId: string, skus: readonly string[] = []) =>
    [...customerPriceKeys.lists(customerId), [...new Set(skus.map(normalizeSku))].sort()] as const,
  detail: (customerId: string, sku: string) =>
    [...customerPriceKeys.customer(customerId), "detail", normalizeSku(sku)] as const,
};

/**
 * Giá riêng của một khách (mảng, không phân trang). `canRead` = `catalog-customer-prices:READ`
 * (UI-only — BE re-check); false hoặc chưa chọn khách thì không gọi API.
 */
export function useCustomerPrices(
  customerId: string | null | undefined,
  canRead: boolean,
  skus: readonly string[] = [],
) {
  return useQuery({
    queryKey: customerPriceKeys.list(customerId ?? "", skus),
    queryFn: ({ signal }) => listCustomerPrices(customerId ?? "", skus, signal),
    enabled: Boolean(customerId) && canRead,
    ...QUERY_TIMES.list,
  });
}

/** Giá của khách cho một SKU; 404 CUSTOMER_PRICE_NOT_FOUND là lỗi (không bịa bảng giá rỗng). */
export function useCustomerPrice(
  customerId: string | null | undefined,
  sku: string | null | undefined,
  canRead: boolean,
) {
  return useQuery({
    queryKey: customerPriceKeys.detail(customerId ?? "", sku ?? ""),
    queryFn: ({ signal }) => getCustomerPrice(customerId ?? "", sku ?? "", signal),
    enabled: Boolean(customerId) && Boolean(sku) && canRead,
    ...QUERY_TIMES.detail,
  });
}
