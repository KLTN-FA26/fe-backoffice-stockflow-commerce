import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getWarehouseLayout, listWarehouses } from "./api";
import { hasStockAt, listShelfStock, listWarehouseStock } from "./api-draft";

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

/** Tồn theo vị trí của kệ / khu vực đang chọn — chặn dời / ngừng vị trí còn hàng (BR-04, C22). */
export const placeStockKeys = {
  all: ["warehouse-map", "place-stock"] as const,
  of: (warehouseId: string, locationCode: string, exact: boolean) =>
    [...placeStockKeys.all, warehouseId, locationCode, exact] as const,
};

export function usePlaceHasStock(
  input: { warehouseId: string; locationCode: string; exact: boolean } | null,
) {
  return useQuery({
    queryKey: placeStockKeys.of(
      input?.warehouseId ?? "",
      input?.locationCode ?? "",
      input?.exact ?? false,
    ),
    queryFn: ({ signal }) => (input ? hasStockAt(input, signal) : Promise.resolve(false)),
    enabled: input !== null,
    ...QUERY_TIMES.detail,
  });
}

/** Hàng trên kệ đang chọn ở 3D — chỉ đọc, cùng nguồn tồn theo vị trí (BR-05). */
export const shelfStockKeys = {
  all: ["warehouse-map", "shelf-stock"] as const,
  of: (warehouseId: string, locationCode: string) =>
    [...shelfStockKeys.all, warehouseId, locationCode] as const,
};

export function useShelfStock(input: { warehouseId: string; locationCode: string } | null) {
  return useQuery({
    queryKey: shelfStockKeys.of(input?.warehouseId ?? "", input?.locationCode ?? ""),
    queryFn: ({ signal }) => (input ? listShelfStock(input, signal) : Promise.resolve([])),
    enabled: input !== null,
    ...QUERY_TIMES.detail,
  });
}

/** Tồn cả kho cho toàn cảnh 3D (thùng ở mọi bin có hàng) — chỉ đọc, nguồn tồn theo vị trí (BR-05). */
export const warehouseStockKeys = {
  all: ["warehouse-map", "warehouse-stock"] as const,
  of: (warehouseId: string) => [...warehouseStockKeys.all, warehouseId] as const,
};

export function useWarehouseStock(warehouse: { id: string; prefix: string }) {
  return useQuery({
    queryKey: warehouseStockKeys.of(warehouse.id),
    queryFn: ({ signal }) =>
      listWarehouseStock({ warehouseId: warehouse.id, prefix: warehouse.prefix }, signal),
    ...QUERY_TIMES.detail,
  });
}
