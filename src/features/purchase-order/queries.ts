/**
 * Purchase Order — query hooks (React Query).
 *
 * Uses createQueryKeys / createListQuery / createDetailQuery factories.
 */

import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import {
  fetchPoStatusDashboard,
  getPurchaseOrder,
  listPoSuppliers,
  listPoWarehouses,
  listPurchaseOrders,
  listReplenishmentProposals,
  listSupplierSpend,
} from "./api";

import type { ListPoParams, SupplierSpendParams } from "./api";
import type { PoStatusCount, SupplierSpendRow } from "./schemas";
import type { PurchaseOrder, ReplenishmentProposal, Supplier, Warehouse } from "./types";

/* ── Query keys ──────────────────────────────────────────────────────── */

export const poKeys = createQueryKeys<ListPoParams>("purchase-orders");

export const replenishmentKeys = createQueryKeys<{
  page?: number;
  pageSize?: number;
}>("replenishment-proposals");

export const poSupplierKeys = createQueryKeys<Record<string, unknown>>("po-suppliers");
export const poWarehouseKeys = createQueryKeys<Record<string, unknown>>("po-warehouses");
export const poDashboardKeys = createQueryKeys<Record<string, never>>("po-status-dashboard");
export const supplierSpendKeys = createQueryKeys<SupplierSpendParams>("po-supplier-spend");

/* ── List hooks ──────────────────────────────────────────────────────── */

export const usePurchaseOrders = createListQuery<PurchaseOrder, ListPoParams>(
  poKeys,
  listPurchaseOrders,
);

export const useReplenishmentProposals = createListQuery<
  ReplenishmentProposal,
  { page?: number; pageSize?: number }
>(replenishmentKeys, listReplenishmentProposals);

export const usePoSuppliers = createListQuery<Supplier, Record<string, unknown>>(
  poSupplierKeys,
  (_, signal) => listPoSuppliers(signal),
);

export const usePoWarehouses = createListQuery<Warehouse, Record<string, unknown>>(
  poWarehouseKeys,
  (_, signal) => listPoWarehouses(signal),
);

/* ── Dashboard ───────────────────────────────────────────────────────── */

export function usePoStatusDashboard() {
  return useQuery<PoStatusCount[]>({
    queryKey: poDashboardKeys.list({}),
    queryFn: ({ signal }) => fetchPoStatusDashboard(signal),
    ...QUERY_TIMES.list,
  });
}

export const useSupplierSpend = createListQuery<SupplierSpendRow, SupplierSpendParams>(
  supplierSpendKeys,
  listSupplierSpend,
);

/* ── Detail hooks ────────────────────────────────────────────────────── */

export const usePurchaseOrder = createDetailQuery<PurchaseOrder>(poKeys, getPurchaseOrder);
