/**
 * Order — query hooks (React Query).
 *
 * Uses createQueryKeys / createListQuery / createDetailQuery factories.
 */

import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getOrder, listOrders, type ListOrderParams } from "./api";
import type { Order } from "./types";

/* ── Query keys ──────────────────────────────────────────────────────── */

export const orderKeys = createQueryKeys<ListOrderParams>("orders");

/* ── List hooks ──────────────────────────────────────────────────────── */

export const useOrders = createListQuery<Order, ListOrderParams>(orderKeys, listOrders);

/* ── Detail hooks ────────────────────────────────────────────────────── */

export const useOrder = createDetailQuery<Order>(orderKeys, getOrder);
