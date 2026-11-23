import { useQuery } from "@tanstack/react-query";

import { MOVE_QUERY_KEYS } from "@/constants/move";

import { QUERY_TIMES } from "@/lib/api/query-client";

import { getWarehouseLayout, listStockRows } from "./api";
import { destinationCodes } from "./selectors";

export const moveKeys = {
  // Under the shared stock root: orders, adjustments and moves that change stock refresh it.
  stockRows: (warehouseId: string, sku: string) =>
    [MOVE_QUERY_KEYS.stock, "move-rows", warehouseId, sku] as const,
  layout: (warehouseId: string) => [MOVE_QUERY_KEYS.layout, warehouseId] as const,
};

export function useStockRows(warehouseId: string, sku: string, enabled: boolean) {
  return useQuery({
    queryKey: moveKeys.stockRows(warehouseId, sku),
    queryFn: ({ signal }) => listStockRows(warehouseId, sku, signal),
    enabled: enabled && sku !== "",
    retry: false,
  });
}

/**
 * Usable locations of the tab warehouse (docs 11 BR-03) — the move screen works in one warehouse (spec 2026-11-22), so
 * the map is read straight by its id; any failure just means no suggestions.
 */
export function useDestinationCodes(warehouseId: string, enabled: boolean) {
  const layout = useQuery({
    queryKey: moveKeys.layout(warehouseId),
    queryFn: ({ signal }) => getWarehouseLayout(warehouseId, signal),
    enabled,
    retry: false,
    ...QUERY_TIMES.master,
  });
  return { codes: destinationCodes(layout.data), isLoading: layout.isLoading };
}
