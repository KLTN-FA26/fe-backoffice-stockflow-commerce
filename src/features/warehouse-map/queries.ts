import { useCallback } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getWarehouseLayout, listWarehouses } from "./api";
import { getLocationSummary, listLocationCartonPage, listLocationCartons } from "./api-cartons";
import { hasStockAt, listShelfStock, listWarehouseStock } from "./api-draft";

import type { ListWarehouseParams } from "./api";
import type { LocationCarton } from "./api-cartons";
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

/** `enabled` false khi người xem không đọc được tồn của kho (thiếu quyền / không được gán) — tránh 403 vô ích. */
export function useWarehouseStock(warehouse: { id: string; prefix: string }, enabled = true) {
  return useQuery({
    queryKey: warehouseStockKeys.of(warehouse.id),
    queryFn: ({ signal }) =>
      listWarehouseStock({ warehouseId: warehouse.id, prefix: warehouse.prefix }, signal),
    enabled,
    ...QUERY_TIMES.detail,
  });
}

/** Thùng (LPN) theo từng bin của kệ đang xem ở 3D — một request mỗi bin có hàng (API lọc đúng một mã). */
export const binCartonKeys = createQueryKeys("warehouse-map-bin-cartons");

/**
 * LPN theo mã bin; `null` khi chưa đọc xong / lỗi / không được đọc (`enabled` false) — khi đó cảnh vẽ thùng ước
 * lượng từ số lượng tồn, không dán tem.
 */
export function useBinCartons(locationCodes: readonly string[], enabled: boolean) {
  // `combine` ổn định: React Query chỉ tính lại Map khi kết quả đổi — cảnh 3D dựng lại thùng theo tham chiếu Map
  const combine = useCallback(
    (results: { isSuccess: boolean; data?: LocationCarton[] }[]) =>
      enabled && results.every((result) => result.isSuccess)
        ? new Map(
            locationCodes.map((code, i) => [code, (results[i]?.data ?? []).map((c) => c.lpn)]),
          )
        : null,
    [locationCodes, enabled],
  );
  return useQueries({
    queries: locationCodes.map((code) => ({
      queryKey: binCartonKeys.detail(code),
      queryFn: ({ signal }: { signal: AbortSignal }) => listLocationCartons(code, signal),
      enabled,
      ...QUERY_TIMES.detail,
    })),
    combine,
  });
}

/** Một vị trí đang chứa gì (panel chi tiết của danh sách vị trí) — theo SKU, lô, trạng thái tồn. */
export const locationSummaryKeys = createQueryKeys("warehouse-map-location-summary");

export function useLocationSummary(locationCode: string, enabled: boolean) {
  return useQuery({
    queryKey: locationSummaryKeys.detail(locationCode),
    queryFn: ({ signal }) => getLocationSummary(locationCode, signal),
    enabled,
    ...QUERY_TIMES.detail,
  });
}

/** Thùng (LPN) của một vị trí kèm tổng số — trang đầu, sắp theo LPN. */
export const locationCartonPageKeys = createQueryKeys("warehouse-map-location-cartons");

export function useLocationCartons(locationCode: string, enabled: boolean) {
  return useQuery({
    queryKey: locationCartonPageKeys.detail(locationCode),
    queryFn: ({ signal }) => listLocationCartonPage(locationCode, signal),
    enabled,
    ...QUERY_TIMES.detail,
  });
}
