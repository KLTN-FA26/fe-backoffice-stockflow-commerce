import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getWarehouseLayout, listWarehouses } from "./api";

import type { ListWarehouseParams } from "./api";
import type { Warehouse } from "./types";

/** Khoá gốc `warehouse-warehouses` = mã resource BE: tạo kho làm mới danh sách qua `all`. */
export const warehouseKeys = createQueryKeys<ListWarehouseParams>("warehouse-warehouses");

/** Bản đồ theo kho — mọi thao tác sửa bản đồ làm mới đúng kho đó. */
export const warehouseLayoutKeys = {
  all: ["warehouse-map", "layout"] as const,
  of: (warehouseId: string) => [...warehouseLayoutKeys.all, warehouseId] as const,
};

export const useWarehouses = createListQuery<Warehouse, ListWarehouseParams>(
  warehouseKeys,
  listWarehouses,
);

export function useWarehouseLayout(warehouseId: string | null, enabled = true) {
  return useQuery({
    queryKey: warehouseLayoutKeys.of(warehouseId ?? ""),
    queryFn: ({ signal }) => getWarehouseLayout(warehouseId ?? "", signal),
    enabled: enabled && Boolean(warehouseId),
    ...QUERY_TIMES.detail,
  });
}
