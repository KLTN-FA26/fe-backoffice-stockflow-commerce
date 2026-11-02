"use client";

import { useQueries } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";

import { hasStockAt } from "@/features/warehouse-map/api-draft";
import { placeStockKeys } from "@/features/warehouse-map/queries";

import type { DraftItem } from "@/features/warehouse-map/draft";
import type { StockState } from "@/features/warehouse-map/lifecycle";
import type { WarehouseLayout } from "@/features/warehouse-map/types";

/** Vị trí tồn cần hỏi cho một hình — hình mới, tường / cửa, khu NON_STORAGE không có tồn (BR-11). */
export function stockProbe(warehouse: WarehouseLayout["warehouse"], item: DraftItem | null) {
  if (!item || item.id === null || item.kind === "boundary") return null;
  if (item.kind === "area" && !item.wasStorage) return null;
  return {
    warehouseId: warehouse.id,
    locationCode: `${warehouse.prefix}-${item.code}`,
    exact: item.kind === "area",
  };
}

const stateOf = (query: { isError: boolean; data: boolean | undefined }): StockState =>
  query.isError
    ? "unknown"
    : query.data === undefined
      ? "checking"
      : query.data
        ? "stocked"
        : "free";

/**
 * Tồn của từng hình trong vùng chọn (chọn nhiều) — để xoá hàng loạt chỉ xoá vị trí đã biết không còn
 * hàng (BR-04). Cùng khoá query với hình chọn lẻ nên kết quả dùng chung cache. Hình không cần hỏi → free.
 */
export function useGroupStock(
  warehouse: WarehouseLayout["warehouse"],
  group: readonly DraftItem[],
): (item: DraftItem) => StockState {
  const probes = group.flatMap((item) => {
    const probe = stockProbe(warehouse, item);
    return probe ? [{ key: item.key, probe }] : [];
  });
  const results = useQueries({
    queries: probes.map(({ probe }) => ({
      queryKey: placeStockKeys.of(probe.warehouseId, probe.locationCode, probe.exact),
      queryFn: ({ signal }: { signal: AbortSignal }) => hasStockAt(probe, signal),
      ...QUERY_TIMES.detail,
    })),
  });
  const states = new Map(probes.map(({ key }, index) => [key, results[index]]));
  return (item) => {
    const query = states.get(item.key);
    return query ? stateOf(query) : "free";
  };
}
