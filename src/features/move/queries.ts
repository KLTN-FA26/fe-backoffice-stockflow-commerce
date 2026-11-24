import { useQuery } from "@tanstack/react-query";

import { MOVE_QUERY_KEYS } from "@/constants/move";

import { QUERY_TIMES } from "@/lib/api/query-client";

import { getWarehouseLayout, listCartons } from "./api";
import { destinationCodes } from "./selectors";

type CartonQuery = { location: string } | { sku: string };

export const moveKeys = {
  // Dưới gốc thùng chung: chuyển, cách ly, điều chỉnh đổi thùng đều làm mới nó.
  cartons: (query: CartonQuery) =>
    [MOVE_QUERY_KEYS.stockPackage, MOVE_QUERY_KEYS.cartons, query] as const,
  layout: (warehouseId: string) => [MOVE_QUERY_KEYS.layout, warehouseId] as const,
};

/** Bộ tìm thùng (docs 11 §4.1): thùng IN_STOCK theo SKU hoặc theo vị trí; `null` → không tìm. */
export function useCartonSearch(query: CartonQuery | null, enabled: boolean) {
  return useQuery({
    queryKey: moveKeys.cartons(query ?? { sku: "" }),
    queryFn: ({ signal }) => listCartons(query ?? { sku: "" }, signal),
    enabled: enabled && query !== null,
    retry: false,
  });
}

/**
 * Usable locations of the tab warehouse (docs 11 BR-03, BR-09: không khu tập kết), trừ vị trí hiện tại của các thùng
 * đang chọn — the move screen works in one warehouse (spec 2026-11-22), so the map is read straight by its id; any
 * failure just means no suggestions.
 */
export function useDestinationCodes(
  warehouseId: string,
  enabled: boolean,
  exclude: readonly string[],
) {
  const layout = useQuery({
    queryKey: moveKeys.layout(warehouseId),
    queryFn: ({ signal }) => getWarehouseLayout(warehouseId, signal),
    enabled,
    retry: false,
    ...QUERY_TIMES.master,
  });
  return { codes: destinationCodes(layout.data, exclude), isLoading: layout.isLoading };
}
