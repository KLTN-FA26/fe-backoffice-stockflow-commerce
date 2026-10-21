/**
 * Order — query hooks (React Query).
 *
 * Uses createQueryKeys / createListQuery / createDetailQuery factories.
 */

import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/error";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getOrder, getOrderHistory, listOrders, type ListOrderParams } from "./api";
import type { Order, OrderHistoryEntry } from "./types";

/* ── Query keys ──────────────────────────────────────────────────────── */

export const orderKeys = {
  ...createQueryKeys<ListOrderParams>("orders"),
  /** Lịch sử một đơn — dưới root `orders` nên mọi mutation của đơn (invalidate `orderKeys.all`) làm mới luôn. */
  history: (id: string) => ["orders", "history", id] as const,
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
