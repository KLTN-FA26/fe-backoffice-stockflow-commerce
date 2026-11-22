/**
 * Kho xuất của đơn — query hook + key (docs 17 §4.2 bước 2-3). Key nằm dưới `orderKeys.all`: chọn kho (invalidate
 * `orderKeys.all`) làm mới luôn tình trạng giữ hàng, danh sách kho và chi tiết đơn.
 */

import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/error";
import { QUERY_TIMES } from "@/lib/api/query-client";

import { orderKeys } from "./queries";
import { getShippingCoverage, getShippingWarehouseOptions } from "./shipping-warehouse-api";

export const shippingWarehouseKeys = {
  all: [...orderKeys.all, "shipping-warehouse-view"] as const,
  options: (orderId: string) => [...shippingWarehouseKeys.all, "options", orderId] as const,
  coverage: (orderId: string) => [...shippingWarehouseKeys.all, "coverage", orderId] as const,
};

/** Chỉ retry lỗi tạm thời (mạng / 5xx); 4xx và lỗi parse không retry. */
function retryTransient(failureCount: number, error: unknown): boolean {
  if (!(error instanceof ApiError) || error.isClientError) return false;
  return failureCount < 2;
}

/**
 * Các kho đơn có thể xuất từ đó, tốt nhất đầu danh sách (cần `sales-order-shipping-warehouses:READ`). Số liệu tồn và
 * sức chứa đổi liên tục nên luôn tải lại mỗi lần mở hộp thoại (`staleTime` 0).
 */
export function useShippingWarehouseOptions(orderId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: shippingWarehouseKeys.options(orderId),
    queryFn: ({ signal }) => getShippingWarehouseOptions(orderId, signal),
    staleTime: 0,
    gcTime: QUERY_TIMES.detail.gcTime,
    enabled: !!orderId && (options.enabled ?? true),
    retry: retryTransient,
  });
}

/** Tình trạng giữ hàng của đơn ở kho xuất, theo dòng và đợt giao (cần `sales-order-shipping-warehouses:READ`). */
export function useShippingCoverage(orderId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: shippingWarehouseKeys.coverage(orderId),
    queryFn: ({ signal }) => getShippingCoverage(orderId, signal),
    ...QUERY_TIMES.detail,
    enabled: !!orderId && (options.enabled ?? true),
    retry: retryTransient,
  });
}
