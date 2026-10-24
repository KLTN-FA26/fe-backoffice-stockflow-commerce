/**
 * Order — query hooks (React Query).
 *
 * Uses createQueryKeys / createListQuery / createDetailQuery factories. Key con (history,
 * production-orders, credit-holds) nằm dưới `orderKeys.all` để mọi mutation đơn chỉ cần
 * invalidate `orderKeys.all`.
 */

import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/error";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import {
  getCreditPosition,
  listCreditHolds,
  listOrderProductionOrders,
  type ListCreditHoldParams,
} from "./action-api";
import { getOrder, listOrders, type ListOrderParams } from "./api";
import { getOrderHistory } from "./history-api";
import { isValidOrderCustomerId } from "./schemas";

import type { CreditHold, Order, OrderHistoryEntry } from "./types";

/* ── Query keys ──────────────────────────────────────────────────────── */

const baseOrderKeys = createQueryKeys<ListOrderParams>("orders");

export const orderKeys = {
  ...baseOrderKeys,
  /** Lịch sử một đơn — dưới root `orders` nên mọi mutation của đơn (invalidate `orderKeys.all`) làm mới luôn. */
  history: (id: string) => [...baseOrderKeys.all, "history", id] as const,
  productionOrders: (id: string) => [...baseOrderKeys.detail(id), "production-orders"] as const,
  creditHolds: (params?: ListCreditHoldParams) =>
    [...baseOrderKeys.all, "credit-holds", params] as const,
  // Dưới `orderKeys.all`: thao tác đơn (duyệt / từ chối / huỷ) đổi dư nợ → tự tải lại
  creditPosition: (customerId: string) =>
    [...baseOrderKeys.all, "credit-position", customerId] as const,
};

/**
 * Chỉ retry lỗi tạm thời (mạng / 5xx), tối đa 2 lần. KHÔNG retry lỗi sai hợp đồng (ZodError
 * khi parse response) — lặp lại y hệt, retry chỉ làm người dùng chờ thêm mới thấy lỗi.
 */
function retryTransient(failureCount: number, error: unknown): boolean {
  if (!(error instanceof ApiError) || error.isClientError) return false;
  return failureCount < 2;
}

/* ── List hooks ──────────────────────────────────────────────────────── */

export const useOrders = createListQuery<Order, ListOrderParams>(orderKeys, listOrders, {
  retry: retryTransient,
});

export const useCreditHolds = createListQuery<CreditHold, ListCreditHoldParams>(
  { ...orderKeys, list: orderKeys.creditHolds },
  listCreditHolds,
  { retry: retryTransient },
);

/* ── Detail hooks ────────────────────────────────────────────────────── */

export const useOrder = createDetailQuery<Order>(orderKeys, getOrder, { retry: retryTransient });

/**
 * Lịch sử đơn (cần `sales-orders:READ`): chỉ gọi khi `enabled`. Mutation của đơn invalidate
 * `orderKeys.all` nên lịch sử (có thêm một mục quyết định / đổi trạng thái) tự tải lại.
 */
export function useOrderHistory(id: string, options: { enabled?: boolean } = {}) {
  return useQuery<OrderHistoryEntry[], ApiError>({
    queryKey: orderKeys.history(id),
    queryFn: ({ signal }) => getOrderHistory(id, signal),
    ...QUERY_TIMES.detail,
    enabled: options.enabled ?? true,
    retry: retryTransient,
  });
}

/** LSX của đơn (`production-schemas.ts`). Lỗi 4xx (403 thiếu quyền…) không retry. */
export function useOrderProductionOrders(id: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: orderKeys.productionOrders(id),
    queryFn: ({ signal }) => listOrderProductionOrders(id, signal),
    enabled: !!id && (options.enabled ?? true),
    retry: retryTransient,
  });
}

/**
 * Công nợ HIỆN TẠI của một khách — chỉ gọi khi màn cần (dialog quyết định đang mở), KHÔNG theo
 * từng dòng hàng đợi. Không gọi khi thiếu quyền / id không phải UUID. Cache theo khách.
 */
export function useCreditPosition(customerId: string | null, options: { enabled?: boolean } = {}) {
  const id = customerId ?? "";
  return useQuery({
    queryKey: orderKeys.creditPosition(id),
    queryFn: ({ signal }) => getCreditPosition(id, signal),
    enabled: (options.enabled ?? true) && isValidOrderCustomerId(id),
    retry: retryTransient,
  });
}
