/**
 * Purchase Order — query hooks (React Query).
 *
 * Uses createQueryKeys / createListQuery / createDetailQuery factories.
 */

import { createQueryKeys, createListQuery, createDetailQuery } from "@/lib/api/query-factory";
import type { LegacyPaginatedResponse } from "@/lib/api/query-factory";
import {
  listPurchaseOrders,
  getPurchaseOrder,
  listPoSuppliers,
  listPoWarehouses,
  listReplenishmentProposals,
  type ListPoParams,
} from "./api";
import type { PurchaseOrder, ReplenishmentProposal, Supplier, Warehouse } from "./types";

/* ── Query keys ──────────────────────────────────────────────────────── */

export const poKeys = createQueryKeys<ListPoParams>("purchase-orders");

export const replenishmentKeys = createQueryKeys<{
  page?: number;
  pageSize?: number;
}>("replenishment-proposals");

export const poSupplierKeys = createQueryKeys<Record<string, unknown>>("po-suppliers");
export const poWarehouseKeys = createQueryKeys<Record<string, unknown>>("po-warehouses");

/* ── List hooks ──────────────────────────────────────────────────────── */

export const usePurchaseOrders = createListQuery<
  PurchaseOrder,
  ListPoParams,
  LegacyPaginatedResponse<PurchaseOrder>
>(poKeys, listPurchaseOrders);

export const useReplenishmentProposals = createListQuery<
  ReplenishmentProposal,
  { page?: number; pageSize?: number },
  LegacyPaginatedResponse<ReplenishmentProposal>
>(replenishmentKeys, listReplenishmentProposals);

export const usePoSuppliers = createListQuery<
  Supplier,
  Record<string, unknown>,
  LegacyPaginatedResponse<Supplier>
>(poSupplierKeys, (_, signal) => listPoSuppliers(signal));

export const usePoWarehouses = createListQuery<
  Warehouse,
  Record<string, unknown>,
  LegacyPaginatedResponse<Warehouse>
>(poWarehouseKeys, (_, signal) => listPoWarehouses(signal));

/* ── Detail hooks ────────────────────────────────────────────────────── */

export const usePurchaseOrder = createDetailQuery<PurchaseOrder>(poKeys, getPurchaseOrder);
