import { useQuery } from "@tanstack/react-query";

import { INVENTORY_QUERY_KEYS } from "@/constants/inventory";

import { createQueryKeys } from "@/lib/api/query-factory";
import { useAppStore } from "@/lib/store/use-app-store";

import {
  getAdjustment,
  getAtp,
  getStockLevels,
  listAdjustments,
  listMovements,
  listReservations,
  listStockAlerts,
  listWarehouseStockItems,
} from "./api";
import {
  atpInput,
  reservationListInput,
  stockAlertListInput,
  stockLevelsInput,
  warehouseStockItemsInput,
} from "./stock-schemas";

import type { z } from "zod";
import type { InventoryService } from "./service";
import type {
  AdjustmentListParams,
  AtpLookupInput,
  MovementListParams,
  ReservationListParams,
  StockAlertListParams,
  WarehouseStockItemsParams,
} from "./types";

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

// ── Inventory overview reads (SCRUM-438) ─────────────────────────────────────────────────────
// Keys hold the normalised wire params (upper-cased SKU, blanks dropped, lists comma-joined), so
// equivalent inputs share one cache entry. Stock keys sit under the shared stock root, which an
// adjustment approval already invalidates. Nothing is requested until its lookup values parse.

export const stockKeys = {
  all: [INVENTORY_QUERY_KEYS.stock] as const,
  levels: (sku: string | null, warehouseId: string | null) =>
    [...stockKeys.all, "levels", warehouseId, sku] as const,
  warehouseItems: (
    params: z.output<typeof warehouseStockItemsInput> | null,
    warehouseId: string | null,
  ) =>
    [
      ...stockKeys.all,
      "warehouse-items",
      warehouseId,
      params?.warehouseId ?? null,
      params,
    ] as const,
  atp: (sku: string | null, warehouseCode: string | null, warehouseId: string | null) =>
    [...stockKeys.all, "atp", warehouseId, sku, warehouseCode] as const,
};

export const stockReservationKeys = {
  all: [INVENTORY_QUERY_KEYS.reservations] as const,
  list: (params: z.output<typeof reservationListInput> | null, warehouseId: string | null) =>
    [...stockReservationKeys.all, "list", warehouseId, params] as const,
};

export const stockAlertKeys = {
  all: [INVENTORY_QUERY_KEYS.alerts] as const,
  list: (params: z.output<typeof stockAlertListInput> | null, warehouseId: string | null) =>
    [...stockAlertKeys.all, "list", warehouseId, params] as const,
};

function normalised<S extends z.ZodType>(schema: S, input: z.input<S>): z.output<S> | null {
  const parsed = schema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function useStockLevels(sku: string) {
  const warehouseId = useAppStore((state) => state.warehouseId);
  const params = normalised(stockLevelsInput, { sku });
  return useQuery({
    queryKey: stockKeys.levels(params?.sku ?? null, warehouseId),
    queryFn: ({ signal }) => getStockLevels({ sku }, signal),
    enabled: params !== null,
  });
}

export function useWarehouseStockItems(input: WarehouseStockItemsParams) {
  const warehouseId = useAppStore((state) => state.warehouseId);
  const params = normalised(warehouseStockItemsInput, input);
  return useQuery({
    queryKey: stockKeys.warehouseItems(params, warehouseId),
    queryFn: ({ signal }) => listWarehouseStockItems(input, signal),
    enabled: params !== null,
    placeholderData: (previous, query) =>
      query?.queryKey[2] === warehouseId ? previous : undefined,
  });
}

/** Always scoped to one warehouse code: the backend's system-wide ATP skips warehouse scope. */
export function useAtp(input: { sku: string; warehouse: string }) {
  const warehouseId = useAppStore((state) => state.warehouseId);
  const params = normalised(atpInput, input);
  const scoped = params?.warehouse ? params : null;
  return useQuery({
    queryKey: stockKeys.atp(scoped?.sku ?? null, scoped?.warehouse ?? null, warehouseId),
    queryFn: ({ signal }) => getAtp(input, signal),
    enabled: scoped !== null,
  });
}

export function useReservations(input: ReservationListParams) {
  const warehouseId = useAppStore((state) => state.warehouseId);
  const params = normalised(reservationListInput, input);
  return useQuery({
    queryKey: stockReservationKeys.list(params, warehouseId),
    queryFn: ({ signal }) => listReservations(input, signal),
    enabled: params !== null,
    placeholderData: (previous, query) =>
      query?.queryKey[2] === warehouseId ? previous : undefined,
  });
}

export function useStockAlerts(input: StockAlertListParams) {
  const warehouseId = useAppStore((state) => state.warehouseId);
  const params = normalised(stockAlertListInput, input);
  return useQuery({
    queryKey: stockAlertKeys.list(params, warehouseId),
    queryFn: ({ signal }) => listStockAlerts(input, signal),
    enabled: params !== null,
    placeholderData: (previous, query) =>
      query?.queryKey[2] === warehouseId ? previous : undefined,
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
