import { useQuery } from "@tanstack/react-query";

import { MOVE_QUERY_KEYS } from "@/constants/move";

import { QUERY_TIMES } from "@/lib/api/query-client";
import {
  fetchActiveWarehouseOptions,
  warehouseOptionKeys,
} from "@/lib/references/warehouse-options";

import { getWarehouseLayout, listStockRows } from "./api";
import { destinationCodes, warehouseOf } from "./selectors";

export const moveKeys = {
  // Under the shared stock root: orders, adjustments and moves that change stock refresh it.
  stockRows: (sku: string) => [MOVE_QUERY_KEYS.stock, "move-rows", sku] as const,
  layout: (warehouseId: string) => [MOVE_QUERY_KEYS.layout, warehouseId] as const,
};

export function useStockRows(sku: string, enabled: boolean) {
  return useQuery({
    queryKey: moveKeys.stockRows(sku),
    queryFn: ({ signal }) => listStockRows(sku, signal),
    enabled: enabled && sku !== "",
    retry: false,
  });
}

/**
 * Usable locations of the source's warehouse (docs 11 BR-03). The warehouse is found from the
 * code prefix through the shared warehouse lookup; any failure just means no suggestions.
 */
export function useDestinationCodes(fromLocation: string, enabled: boolean) {
  const prefix = warehouseOf(fromLocation);
  // Same query key as the shared `useWarehouseOptions`, but only fetched once there is a source to
  // resolve and the caller may read the map.
  const warehouses = useQuery({
    queryKey: warehouseOptionKeys.active(),
    queryFn: ({ signal }) => fetchActiveWarehouseOptions(signal),
    enabled: enabled && prefix !== "",
    retry: false,
    ...QUERY_TIMES.master,
  });
  const warehouse = warehouses.data?.find((option) => option.code.toUpperCase() === prefix);
  const layout = useQuery({
    queryKey: moveKeys.layout(warehouse?.warehouseId ?? ""),
    queryFn: ({ signal }) => getWarehouseLayout(warehouse?.warehouseId ?? "", signal),
    enabled: enabled && Boolean(warehouse) && prefix !== "",
    retry: false,
    ...QUERY_TIMES.master,
  });
  return { codes: destinationCodes(layout.data), isLoading: layout.isLoading };
}
