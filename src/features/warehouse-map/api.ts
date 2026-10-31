/**
 * Module 06 — danh mục kho và bản đồ kho, base `/api/v1` (BE `WarehouseController`,
 * `LayoutController`, `ZoneController`, `ShelfController`, `AreaController`, `BoundaryController`):
 *
 *   GET  /warehouses?page&size&q&status         → PageResponse<Warehouse>   (warehouse-warehouses:READ)
 *   POST /warehouses                            → 201; 409 WAREHOUSE_PREFIX_ALREADY_EXISTS  (…:CREATE)
 *   GET  /warehouses/{id}/layout                → WarehouseLayout            (warehouse-locations:READ)
 *   POST /shelves/{id}/levels · /shelves/{id}/bin-generation                (warehouse-locations:CREATE)
 *   PUT  /shelves/{id}/status · /areas/{id}/status                          (warehouse-locations:UPDATE)
 *   DELETE /boundaries/{id}?version=                                        (warehouse-locations:DELETE)
 *
 * Tạo / sửa zone, kệ, khu vực, tường-cửa của bản nháp bản đồ: `api-draft.ts`.
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import {
  createdRefDto,
  generatedBinsDto,
  warehouseDto,
  warehouseLayoutDto,
  warehousePageDto,
} from "./schemas";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type {
  BinGeneration,
  PlaceStatusInput,
  Warehouse,
  WarehouseCreateBody,
  WarehouseLayout,
} from "./types";

export const WAREHOUSES_PATH = "/warehouses";
const id = (value: string) => encodeURIComponent(value);
export const warehouseLayoutPath = (warehouseId: string) =>
  `${WAREHOUSES_PATH}/${id(warehouseId)}/layout`;

export interface ListWarehouseParams {
  page?: number;
  size?: number;
  /** BE `q` — khớp prefix hoặc tên. */
  q?: string;
  status?: Warehouse["status"];
  [key: string]: unknown;
}

export async function listWarehouses(
  params: ListWarehouseParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Warehouse>> {
  const { data } = await api.get<unknown>(WAREHOUSES_PATH, {
    params: {
      page: Math.max(0, params.page ?? 0),
      size: params.size ?? PAGE_SIZE.md,
      q: params.q?.trim() || undefined,
      status: params.status || undefined,
      sort: "name,asc",
    },
    signal,
  });
  return warehousePageDto.parse(data);
}

export async function createWarehouse(body: WarehouseCreateBody): Promise<Warehouse> {
  const { data } = await api.post<unknown>(WAREHOUSES_PATH, body);
  return warehouseDto.parse(data);
}

export async function getWarehouseLayout(
  warehouseId: string,
  signal?: AbortSignal,
): Promise<WarehouseLayout> {
  const { data } = await api.get<unknown>(warehouseLayoutPath(warehouseId), { signal });
  return warehouseLayoutDto.parse(data);
}

/** `levelIndex` không đổi được và nằm trong mã vị trí (BR-13); cao độ xếp đều theo chiều cao tầng. */
export async function addShelfLevel(shelfId: string, levelIndex: number, levelHeight: number) {
  const { data } = await api.post<unknown>(`/shelves/${id(shelfId)}/levels`, {
    levelIndex,
    elevation: Number(((levelIndex - 1) * levelHeight).toFixed(3)),
    usableHeight: levelHeight,
  });
  return createdRefDto.parse(data);
}

/** BR-14 — gửi `Idempotency-Key`: bấm đúp / thử lại không bị 409 SHELF_LEVEL_HAS_BINS. */
export async function generateShelfBins(
  shelfId: string,
  levelIds: string[],
  v: BinGeneration,
  idempotencyKey: string,
) {
  const { data } = await api.post<unknown>(
    `/shelves/${id(shelfId)}/bin-generation`,
    {
      levelIds,
      rowCount: v.rowCount,
      columnCount: v.columnCount,
      namingScheme: v.namingScheme,
      defaults: {
        type: v.binType,
        capacityUnits: v.capacityUnits ?? undefined,
        maxWeight: v.maxWeight ?? undefined,
        pickable: v.pickable,
        putawayTarget: v.putawayTarget,
      },
    },
    idempotencyRequestConfig(idempotencyKey),
  );
  return generatedBinsDto.parse(data);
}

/**
 * Xoá hẳn tường / cửa (BR-04). BE bắt buộc `?version=` của lần đọc gần nhất (thiếu → 400, cũ → 409
 * OPTIMISTIC_LOCK) — xoá không hoàn tác được nên không được dựa trên bản đã cũ.
 */
export async function deleteBoundary(boundaryId: string, version: number): Promise<void> {
  await api.delete(`/boundaries/${id(boundaryId)}`, { params: { version } });
}

/** Không lan xuống con: bin của kệ đọc là không dùng được qua `effectiveStatus` (BR-16). */
export async function changePlaceStatus(input: PlaceStatusInput) {
  const path = input.kind === "shelf" ? "shelves" : "areas";
  const { data } = await api.put<unknown>(`/${path}/${id(input.id)}/status`, {
    status: input.status,
  });
  return createdRefDto.parse(data);
}
