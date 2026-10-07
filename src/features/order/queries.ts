/**
 * Order — query hooks (React Query).
 *
 * Uses createQueryKeys / createListQuery / createDetailQuery factories.
 */

import { ApiError } from "@/lib/api/error";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getOrder, listOrders, type ListOrderParams } from "./api";
import type { Order } from "./types";

/* ── Query keys ──────────────────────────────────────────────────────── */

export const orderKeys = createQueryKeys<ListOrderParams>("orders");

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
