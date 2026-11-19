/**
 * Giao thất bại — query hooks + key (WF-05 GH-1). Key nằm dưới `orderKeys.all`: mọi thao tác đơn (giao lại, huỷ phần
 * chưa giao, release lô giao lại…) invalidate `orderKeys.all` nên hàng đợi và khối trên chi tiết đơn tự tải lại.
 */

import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/error";
import { QUERY_TIMES } from "@/lib/api/query-client";

import { listDeliveryFailures, listOrderDeliveryFailures } from "./delivery-failure-api";
import { orderKeys } from "./queries";

import type { ListDeliveryFailureParams } from "./delivery-failure-api";
import type { DeliveryFailureCase } from "./delivery-failure-schemas";

export const deliveryFailureKeys = {
  all: [...orderKeys.all, "delivery-failures"] as const,
  list: (params: ListDeliveryFailureParams) =>
    [...deliveryFailureKeys.all, "list", params] as const,
  ofOrder: (orderId: string) => [...deliveryFailureKeys.all, "order", orderId] as const,
};

/** Chỉ retry lỗi tạm thời (mạng / 5xx); 4xx và lỗi parse không retry. */
function retryTransient(failureCount: number, error: unknown): boolean {
  if (!(error instanceof ApiError) || error.isClientError) return false;
  return failureCount < 2;
}

/** Hàng đợi giao thất bại (`GET /orders/delivery-failures`, cần `sales-orders:READ`). */
export function useDeliveryFailures(
  params: ListDeliveryFailureParams,
  options: { enabled?: boolean } = {},
) {
  return useQuery<DeliveryFailureCase[], ApiError>({
    queryKey: deliveryFailureKeys.list(params),
    queryFn: ({ signal }) => listDeliveryFailures(params, signal),
    ...QUERY_TIMES.detail,
    enabled: options.enabled ?? true,
    retry: retryTransient,
  });
}

/** Hồ sơ giao thất bại của một đơn — khối "Giao thất bại" trên chi tiết đơn. */
export function useOrderDeliveryFailures(orderId: string, options: { enabled?: boolean } = {}) {
  return useQuery<DeliveryFailureCase[], ApiError>({
    queryKey: deliveryFailureKeys.ofOrder(orderId),
    queryFn: ({ signal }) => listOrderDeliveryFailures(orderId, signal),
    ...QUERY_TIMES.detail,
    enabled: !!orderId && (options.enabled ?? true),
    retry: retryTransient,
  });
}
