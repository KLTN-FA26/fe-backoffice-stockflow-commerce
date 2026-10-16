import { useQuery } from "@tanstack/react-query";

import { INVENTORY_QUERY_KEYS } from "@/constants/inventory";

import { createQueryKeys } from "@/lib/api/query-factory";
import { useAppStore } from "@/lib/store/use-app-store";

import { getAdjustment, listAdjustments, listMovements } from "./api";

import type { InventoryService } from "./service";
import type { AdjustmentListParams, AtpLookupInput, MovementListParams } from "./types";

export const adjustmentKeys = {
  all: [INVENTORY_QUERY_KEYS.adjustments] as const,
  list: (params: AdjustmentListParams, warehouseId: string | null) =>
    [...adjustmentKeys.all, "list", warehouseId, params] as const,
  detail: (id: string, warehouseId: string | null) =>
    [...adjustmentKeys.all, "detail", warehouseId, id] as const,
};

export const movementKeys = {
  all: [INVENTORY_QUERY_KEYS.movements] as const,
  list: (params: MovementListParams, warehouseId: string | null) =>
    [...movementKeys.all, "list", warehouseId, params] as const,
};

export function useMovements(params: MovementListParams) {
  const warehouseId = useAppStore((state) => state.warehouseId);
  return useQuery({
    queryKey: movementKeys.list(params, warehouseId),
    queryFn: ({ signal }) => listMovements(params, signal),
    placeholderData: (previous, query) =>
      query?.queryKey[2] === warehouseId ? previous : undefined,
  });
}

export function useAdjustments(params: AdjustmentListParams) {
  const warehouseId = useAppStore((state) => state.warehouseId);
  return useQuery({
    queryKey: adjustmentKeys.list(params, warehouseId),
    queryFn: ({ signal }) => listAdjustments(params, signal),
    placeholderData: (previous, query) =>
      query?.queryKey[2] === warehouseId ? previous : undefined,
  });
}

export function useAdjustment(id: string) {
  const warehouseId = useAppStore((state) => state.warehouseId);
  return useQuery({
    queryKey: adjustmentKeys.detail(id, warehouseId),
    queryFn: ({ signal }) => getAdjustment(id, signal),
    enabled: Boolean(id),
  });
}

// Inventory overview (SCRUM-438) — reads through the InventoryService port.
const overviewKeys = createQueryKeys("inventory-ui-overview");
const stockItemKeys = createQueryKeys("inventory-ui-stock-items");
const atpKeys = createQueryKeys("inventory-ui-atp");
const reservationKeys = createQueryKeys("inventory-ui-reservations");

export function useInventoryOverviewData(service: InventoryService) {
  return useQuery({
    queryKey: overviewKeys.list({ source: service.cacheKey }),
    queryFn: ({ signal }) => service.loadOverview(signal),
    retry: false,
  });
}

export function useInventoryStockItems(
  service: InventoryService,
  sku: string | undefined,
  warehouseCode: string | undefined,
) {
  return useQuery({
    queryKey: stockItemKeys.list({ source: service.cacheKey, sku, warehouseCode }),
    queryFn: ({ signal }) => service.loadStockItems(sku ?? "", warehouseCode ?? "", signal),
    enabled: Boolean(sku && warehouseCode),
    retry: false,
  });
}

export function useInventoryAtp(service: InventoryService, input: AtpLookupInput | null) {
  return useQuery({
    queryKey: atpKeys.list({ source: service.cacheKey, input }),
    queryFn: ({ signal }) => (input ? service.lookupAtp(input, signal) : Promise.resolve(null)),
    enabled: input !== null,
    retry: false,
  });
}

export function useInventoryReservations(service: InventoryService) {
  return useQuery({
    queryKey: reservationKeys.list({ source: service.cacheKey }),
    queryFn: ({ signal }) => service.loadReservations(signal),
    retry: false,
  });
}
