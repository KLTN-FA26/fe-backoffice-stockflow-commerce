/**
 * Vị trí lưu trữ của một kho — đọc từ sơ đồ kho BE `GET /warehouses/{id}/layout` (LayoutController,
 * cần `warehouse-locations:READ`; NV kho và quản lý kho đều có). Dùng để chọn vị trí trong các màn
 * thao tác kho (lấy hàng, trả hàng về kệ). Chỉ parse phần cần: mã vị trí, loại (bin / khu chứa) và
 * `usable` (= effectiveStatus ACTIVE). Khu NON_STORAGE không có mã vị trí → bỏ.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";

const placeSchema = z.object({
  locationCode: z.string().nullish(),
  usable: z.boolean().nullish(),
});

/** Khu chứa có thêm `type` (BE `AreaType`: RECEIVING, QUARANTINE, DISPATCH, STAGING, OVERFLOW, PRODUCTION…). */
const areaSchema = placeSchema.extend({ type: z.string().nullish() });

const layoutSchema = z.object({
  shelves: z
    .array(z.object({ levels: z.array(z.object({ bins: z.array(placeSchema).default([]) })) }))
    .default([]),
  areas: z.array(areaSchema).default([]),
});

export interface WarehouseLocation {
  locationCode: string;
  kind: "BIN" | "AREA";
  usable: boolean;
  /** Loại khu (BE `AreaType`) — chỉ có với `kind` AREA; bin không có. */
  areaType?: string;
}

export const warehouseLocationKeys = {
  all: ["references", "warehouse-locations"] as const,
  byWarehouse: (warehouseId: string) => [...warehouseLocationKeys.all, warehouseId] as const,
};

export async function fetchWarehouseLocations(
  warehouseId: string,
  signal?: AbortSignal,
): Promise<WarehouseLocation[]> {
  const { data } = await api.get<unknown>(`/warehouses/${encodeURIComponent(warehouseId)}/layout`, {
    signal,
  });
  const layout = layoutSchema.parse(data);
  const byCode = new Map<string, WarehouseLocation>();
  const add = (
    place: z.infer<typeof placeSchema>,
    kind: WarehouseLocation["kind"],
    areaType?: string | null,
  ) => {
    if (!place.locationCode || byCode.has(place.locationCode)) return;
    byCode.set(place.locationCode, {
      locationCode: place.locationCode,
      kind,
      usable: place.usable ?? false,
      ...(areaType ? { areaType } : {}),
    });
  };
  for (const shelf of layout.shelves) {
    for (const level of shelf.levels) for (const bin of level.bins) add(bin, "BIN");
  }
  for (const area of layout.areas) add(area, "AREA", area.type);
  return [...byCode.values()].sort((a, b) => a.locationCode.localeCompare(b.locationCode));
}

/** Vị trí của một kho — dữ liệu master, ít đổi. Chưa biết kho → không gọi. */
export function useWarehouseLocations(warehouseId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: warehouseLocationKeys.byWarehouse(warehouseId ?? ""),
    queryFn: ({ signal }) => fetchWarehouseLocations(warehouseId ?? "", signal),
    enabled: enabled && !!warehouseId,
    ...QUERY_TIMES.master,
  });
}
