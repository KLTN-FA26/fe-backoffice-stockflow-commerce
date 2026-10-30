/**
 * Module 06 — danh mục kho và bản đồ kho, base `/api/v1` (BE `WarehouseController`,
 * `LayoutController`, `ZoneController`, `ShelfController`, `AreaController`, `BoundaryController`):
 *
 *   GET  /warehouses?page&size&q&status         → PageResponse<Warehouse>   (warehouse-warehouses:READ)
 *   POST /warehouses                            → 201; 409 WAREHOUSE_PREFIX_ALREADY_EXISTS  (…:CREATE)
 *   GET  /warehouses/{id}/layout                → WarehouseLayout            (warehouse-locations:READ)
 *   POST /warehouses/{id}/zones|shelves|areas|boundaries                    (warehouse-locations:CREATE)
 *   POST /shelves/{id}/levels · /shelves/{id}/bin-generation                (warehouse-locations:CREATE)
 *   PUT  /shelves/{id}/status · /areas/{id}/status                          (warehouse-locations:UPDATE)
 *   DELETE /boundaries/{id}                                                 (warehouse-locations:DELETE)
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import { isStorageArea } from "./input-schemas-layout";
import {
  createdRefDto,
  generatedBinsDto,
  warehouseDto,
  warehouseLayoutDto,
  warehousePageDto,
} from "./schemas";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type {
  AreaCreateValues,
  BoundaryCreateBody,
  PlaceStatusInput,
  ShelfCreateValues,
  Warehouse,
  WarehouseCreateBody,
  WarehouseLayout,
  ZoneCreateBody,
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

export async function createZone(input: { warehouseId: string; body: ZoneCreateBody }) {
  const { data } = await api.post<unknown>(
    `${WAREHOUSES_PATH}/${id(input.warehouseId)}/zones`,
    input.body,
  );
  return createdRefDto.parse(data);
}

const footprintOf = (v: Pick<ShelfCreateValues, "x" | "y" | "width" | "length" | "rotation">) => ({
  x: v.x,
  y: v.y,
  width: v.width,
  length: v.length,
  rotation: v.rotation,
});

/** Bước 1 của "Thêm kệ" — chỉ kệ; tầng và bin là các request sau (BE không có API gộp). */
export async function createShelf(warehouseId: string, v: ShelfCreateValues) {
  const { data } = await api.post<unknown>(`${WAREHOUSES_PATH}/${id(warehouseId)}/shelves`, {
    code: v.code,
    name: v.name,
    zoneId: v.zoneId || undefined,
    footprint: footprintOf(v),
    obstacle: v.obstacle,
    pickFaces: { north: v.north, east: v.east, south: v.south, west: v.west },
    defaultStorageClass: v.defaultStorageClass,
  });
  return createdRefDto.parse(data);
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
  v: ShelfCreateValues,
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

export async function createArea(input: { warehouseId: string; values: AreaCreateValues }) {
  const v = input.values;
  const { data } = await api.post<unknown>(`${WAREHOUSES_PATH}/${id(input.warehouseId)}/areas`, {
    code: v.code,
    type: v.type,
    name: v.name,
    footprint: footprintOf(v),
    obstacle: v.obstacle,
    // BR-11: khu NON_STORAGE không có vị trí tồn kho
    location: isStorageArea(v.type)
      ? {
          storageClass: v.storageClass,
          capacityUnits: v.capacityUnits ?? undefined,
          maxWeight: v.maxWeight ?? undefined,
          pickable: v.pickable,
          putawayTarget: v.putawayTarget,
        }
      : undefined,
  });
  return createdRefDto.parse(data);
}

export async function createBoundary(input: { warehouseId: string; body: BoundaryCreateBody }) {
  const { data } = await api.post<unknown>(
    `${WAREHOUSES_PATH}/${id(input.warehouseId)}/boundaries`,
    { ...input.body, operationalStatus: input.body.operationalStatus ?? undefined },
  );
  return createdRefDto.parse(data);
}

export async function deleteBoundary(boundaryId: string): Promise<void> {
  await api.delete(`/boundaries/${id(boundaryId)}`);
}

/** Không lan xuống con: bin của kệ đọc là không dùng được qua `effectiveStatus` (BR-16). */
export async function changePlaceStatus(input: PlaceStatusInput) {
  const path = input.kind === "shelf" ? "shelves" : "areas";
  const { data } = await api.put<unknown>(`/${path}/${id(input.id)}/status`, {
    status: input.status,
  });
  return createdRefDto.parse(data);
}
