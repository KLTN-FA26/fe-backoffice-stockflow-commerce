/**
 * DTO module 06 — danh mục kho và bản đồ kho, parse một lần tại biên API (api-conventions §3.2).
 * Hợp đồng: BE `WarehouseResponse`, `WarehouseLayoutResponse`, `ShelfResponse`, `AreaResponse`,
 * `BoundaryResponse`, `ZoneResponse`. BE `default-property-inclusion: non_null` → trường null vắng
 * mặt, nên trường tuỳ chọn dùng `.nullish()`.
 */

import { z } from "zod";

import {
  AREA_TYPES,
  BIN_TYPES,
  BOUNDARY_TYPES,
  DOOR_STATUSES,
  LOCATION_STATUSES,
  MAP_UNITS,
  STORAGE_CLASSES,
  WAREHOUSE_STATUSES,
} from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

/** BE `BigDecimal` → số JSON; nhận cả chuỗi số, chặn NaN. */
const beDecimal = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

/** BE `FootprintResponse` — hình chữ nhật theo mét; (x, y) là góc trên-trái SAU khi xoay. */
export const footprintDto = z.object({
  x: beDecimal,
  y: beDecimal,
  width: beDecimal,
  length: beDecimal,
  rotation: z.number().int(),
});

const locationStatus = z.enum(LOCATION_STATUSES);

export const warehouseDto = z.object({
  id: z.string(),
  prefix: z.string(),
  name: z.string(),
  address: z.string(),
  returnAddress: z.string().nullish(),
  mapUnit: z.enum(MAP_UNITS),
  mapWidth: beDecimal,
  mapHeight: beDecimal,
  status: z.enum(WAREHOUSE_STATUSES),
  version: z.number().int(),
  createdAt: z.string().nullish(),
});

export const warehousePageDto = bePageSchema(warehouseDto);

export const zoneDto = z.object({
  id: z.string(),
  name: z.string(),
  /** `#RRGGBB` do người dùng chọn — dữ liệu, không phải token giao diện. */
  color: z.string().nullish(),
  version: z.number().int(),
});

export const pickFacesDto = z.object({
  north: z.boolean(),
  east: z.boolean(),
  south: z.boolean(),
  west: z.boolean(),
});

/** BE `LayoutBin` — footprint tương đối trong kệ, TRƯỚC khi xoay theo kệ. */
export const layoutBinDto = z.object({
  id: z.string(),
  code: z.string(),
  description: z.string().nullish(),
  footprint: footprintDto,
  type: z.enum(BIN_TYPES),
  storageClassOverride: z.enum(STORAGE_CLASSES).nullish(),
  locationId: z.string(),
  locationCode: z.string(),
  storageClass: z.enum(STORAGE_CLASSES),
  capacityUnits: z.number().int().nullish(),
  maxWeight: beDecimal.nullish(),
  pickable: z.boolean(),
  putawayTarget: z.boolean(),
  status: locationStatus,
  effectiveStatus: locationStatus,
  usable: z.boolean(),
});

export const layoutLevelDto = z.object({
  id: z.string(),
  levelIndex: z.number().int(),
  elevation: beDecimal.nullish(),
  usableHeight: beDecimal.nullish(),
  maxWeight: beDecimal.nullish(),
  bins: z.array(layoutBinDto),
});

export const layoutShelfDto = z.object({
  id: z.string(),
  zoneId: z.string().nullish(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  footprint: footprintDto,
  obstacle: z.boolean(),
  pickFaces: pickFacesDto,
  defaultStorageClass: z.enum(STORAGE_CLASSES),
  status: locationStatus,
  effectiveStatus: locationStatus,
  version: z.number().int(),
  levels: z.array(layoutLevelDto),
});

/** BE `LayoutArea` — khu `NON_STORAGE` không có trường vị trí và không có `usable`. */
export const layoutAreaDto = z.object({
  id: z.string(),
  code: z.string(),
  type: z.enum(AREA_TYPES),
  name: z.string(),
  footprint: footprintDto,
  obstacle: z.boolean(),
  status: locationStatus,
  effectiveStatus: locationStatus,
  usable: z.boolean().nullish(),
  version: z.number().int(),
  locationId: z.string().nullish(),
  locationCode: z.string().nullish(),
  storageClass: z.enum(STORAGE_CLASSES).nullish(),
  capacityUnits: z.number().int().nullish(),
  maxWeight: beDecimal.nullish(),
  pickable: z.boolean().nullish(),
  putawayTarget: z.boolean().nullish(),
});

/** BE `BoundaryResponse` — tường không có `operationalStatus`. */
export const boundaryDto = z.object({
  id: z.string(),
  type: z.enum(BOUNDARY_TYPES),
  startX: beDecimal,
  startY: beDecimal,
  endX: beDecimal,
  endY: beDecimal,
  passable: z.boolean(),
  operationalStatus: z.enum(DOOR_STATUSES).nullish(),
  version: z.number().int(),
});

/** BE `WarehouseLayoutResponse` — cả bản đồ một lần đọc, gồm cả vị trí INACTIVE. */
export const warehouseLayoutDto = z.object({
  warehouse: warehouseDto.pick({
    id: true,
    prefix: true,
    name: true,
    mapUnit: true,
    mapWidth: true,
    mapHeight: true,
    status: true,
    version: true,
  }),
  zones: z.array(zoneDto),
  shelves: z.array(layoutShelfDto),
  areas: z.array(layoutAreaDto),
  boundaries: z.array(boundaryDto),
});

/** BE `ShelfResponse` / `ShelfResponse.Level` / `AreaResponse` — chỉ cần id để bước kế tiếp dùng. */
export const createdRefDto = z.object({ id: z.string() }).loose();

export const generatedBinsDto = z.array(
  z.object({ id: z.string(), levelId: z.string(), locationCode: z.string() }).loose(),
);
