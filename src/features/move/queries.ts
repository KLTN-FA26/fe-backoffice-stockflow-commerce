import { useQuery } from "@tanstack/react-query";

import { MOVE_LIMITS, MOVE_QUERY_KEYS } from "@/constants/move";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { QUERY_TIMES } from "@/lib/api/query-client";

import { getBinSuggestions, getWarehouseLayout, listCartons } from "./api";
import { destinationCodes, suggestionLpns } from "./selectors";

type CartonQuery = { location: string } | { sku: string };

export const moveKeys = {
  // Dưới gốc thùng chung: chuyển, cách ly, điều chỉnh đổi thùng đều làm mới nó.
  cartons: (query: CartonQuery) =>
    [MOVE_QUERY_KEYS.stockPackage, MOVE_QUERY_KEYS.cartons, query] as const,
  layout: (warehouseId: string) => [MOVE_QUERY_KEYS.layout, warehouseId] as const,
  // Dưới gốc thùng chung: chuyển / cách ly / cất hàng đổi chỗ trống của bin → gợi ý tự làm mới.
  binSuggestionsAll: () => [MOVE_QUERY_KEYS.stockPackage, MOVE_QUERY_KEYS.binSuggestions] as const,
  binSuggestions: (lpns: readonly string[]) => [...moveKeys.binSuggestionsAll(), lpns] as const,
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

/**
 * Bin gợi ý cho danh sách thùng (BE #412, docs 11 BR-10). Key = tập LPN đã chuẩn hoá + sắp xếp, đợi ngừng quét
 * (debounce) rồi mới hỏi; danh sách rỗng thì không gọi. Chỉ để tham khảo: lỗi không chặn gửi lệnh, không retry.
 */
export function useBinSuggestions(lpns: readonly string[]) {
  const key = suggestionLpns(lpns).join("\n");
  const settled = useDebouncedValue(key, MOVE_LIMITS.suggestionsDebounceMs);
  const asked = settled === "" ? [] : settled.split("\n");
  const query = useQuery({
    queryKey: moveKeys.binSuggestions(asked),
    queryFn: ({ signal }) => getBinSuggestions(asked, signal),
    enabled: asked.length > 0,
    retry: false,
  });
  // Đang chờ debounce cũng là "đang tải" — không hiện gợi ý của danh sách cũ như của danh sách mới.
  const waiting = key !== settled || (asked.length > 0 && query.isPending);
  return { data: key === "" ? undefined : query.data, isLoading: waiting, isError: query.isError };
}
