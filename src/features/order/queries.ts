/**
 * Order — query hooks (React Query).
 *
 * Uses createQueryKeys / createListQuery / createDetailQuery factories.
 */

import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getOrder, getOrderEvents, listOrders, type ListOrderParams } from "./api";
import type { Order, OrderEvent } from "./types";

/* ── Query keys ──────────────────────────────────────────────────────── */

export const orderKeys = createQueryKeys<ListOrderParams>("orders");

/* ── List hooks ──────────────────────────────────────────────────────── */

export const useOrders = createListQuery<Order, ListOrderParams>(orderKeys, listOrders);

/* ── Detail hooks ────────────────────────────────────────────────────── */

export const useOrder = createDetailQuery<Order>(orderKeys, getOrder);

/** Timeline "Lịch sử sự kiện" — không dùng createDetailQuery vì key khác entity con. */
export function useOrderEvents(id: string | null | undefined) {
  return useQuery<OrderEvent[]>({
    queryKey: [...orderKeys.detail(id ?? ""), "events"],
    queryFn: ({ signal }) => getOrderEvents(id ?? "", signal),
    enabled: !!id,
    ...QUERY_TIMES.detail,
  });
}
