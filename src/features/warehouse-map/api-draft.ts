/**
 * Request lưu bản nháp bản đồ (docs 06 §4.1, §4.2) — BE không có API lưu gộp nên mỗi hình một request:
 *
 *   POST /warehouses/{id}/zones|shelves|areas|boundaries   (warehouse-locations:CREATE)
 *   PUT  /zones/{id} · /shelves/{id} · /areas/{id} · /boundaries/{id}   (…:UPDATE, gửi `version`)
 *   GET  /inventory/warehouses/{id}/stock-items?location=   (inventory stock-items:READ)
 *
 * Mã kệ / khu vực chỉ gửi lúc tạo — PUT không mang mã (BR-13).
 */

import { AREA_TYPE, WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";
import { INVENTORY_API } from "@/constants/inventory";
import { api } from "@/lib/api/client";

import { WAREHOUSES_PATH } from "./api";
import { locationStockDto, savedRefDto, stockProbeDto } from "./schemas";

import type { DraftArea, DraftBoundary, DraftShelf, DraftZone } from "./draft";

const id = (value: string) => encodeURIComponent(value);

export async function saveZone(warehouseId: string, zone: DraftZone) {
  const body = { name: zone.name.trim(), color: zone.color ?? undefined };
  const { data } = zone.id
    ? await api.put<unknown>(`/zones/${id(zone.id)}`, { ...body, version: zone.version })
    : await api.post<unknown>(`${WAREHOUSES_PATH}/${id(warehouseId)}/zones`, body);
  return savedRefDto.parse(data);
}

const shelfBody = (shelf: DraftShelf, zoneId: string | null) => ({
  name: shelf.name.trim(),
  description: shelf.description ?? undefined,
  zoneId: zoneId ?? undefined,
  footprint: shelf.footprint,
  obstacle: shelf.obstacle,
  pickFaces: shelf.pickFaces,
  defaultStorageClass: shelf.defaultStorageClass,
});

/** Tạo kệ (chưa có tầng) hoặc sửa kệ đã lưu — PUT thay toàn bộ, không đổi mã (BR-13). */
export async function saveShelf(warehouseId: string, shelf: DraftShelf, zoneId: string | null) {
  const { data } = shelf.id
    ? await api.put<unknown>(`/shelves/${id(shelf.id)}`, {
        ...shelfBody(shelf, zoneId),
        version: shelf.version,
      })
    : await api.post<unknown>(`${WAREHOUSES_PATH}/${id(warehouseId)}/shelves`, {
        code: shelf.code.trim().toUpperCase(),
        ...shelfBody(shelf, zoneId),
      });
  return savedRefDto.parse(data);
}

export async function saveArea(warehouseId: string, area: DraftArea) {
  const body = {
    type: area.type,
    name: area.name.trim(),
    footprint: area.footprint,
    obstacle: area.obstacle,
    // BR-11 (docs 06 §6): khu NON_STORAGE không phải vị trí tồn kho → không gửi `location`
    location:
      area.type === AREA_TYPE.NON_STORAGE
        ? undefined
        : {
            ...area.location,
            capacityUnits: area.location.capacityUnits ?? undefined,
            maxWeight: area.location.maxWeight ?? undefined,
          },
  };
  const { data } = area.id
    ? await api.put<unknown>(`/areas/${id(area.id)}`, { ...body, version: area.version })
    : await api.post<unknown>(`${WAREHOUSES_PATH}/${id(warehouseId)}/areas`, {
        code: area.code.trim().toUpperCase(),
        ...body,
      });
  return savedRefDto.parse(data);
}

export async function saveBoundary(warehouseId: string, line: DraftBoundary) {
  const body = {
    type: line.type,
    startX: line.startX,
    startY: line.startY,
    endX: line.endX,
    endY: line.endY,
    passable: line.passable,
    operationalStatus: line.operationalStatus ?? undefined,
  };
  const { data } = line.id
    ? await api.put<unknown>(`/boundaries/${id(line.id)}`, { ...body, version: line.version })
    : await api.post<unknown>(`${WAREHOUSES_PATH}/${id(warehouseId)}/boundaries`, body);
  return savedRefDto.parse(data);
}

/**
 * Vị trí còn dòng tồn không. Kệ: mọi bin có mã bắt đầu `PREFIX-KỆ-`; khu vực: đúng mã `PREFIX-KHU`.
 * BE lọc theo tiền tố mã nên khu vực so khớp đúng mã ở client (khu `RCV01` không lẫn `RCV010`).
 */
export async function hasStockAt(
  input: { warehouseId: string; locationCode: string; exact: boolean },
  signal?: AbortSignal,
): Promise<boolean> {
  const location = input.exact ? input.locationCode : `${input.locationCode}-`;
  const { data } = await api.get<unknown>(INVENTORY_API.warehouseStockItems(input.warehouseId), {
    params: { location, page: 0, size: input.exact ? LIMITS.stockProbeSize : 1 },
    signal,
  });
  const page = stockProbeDto.parse(data);
  return input.exact
    ? page.items.some((row) => row.locationCode === input.locationCode)
    : page.totalElements > 0;
}

/** Dòng tồn của mọi bin trên một kệ (mã bắt đầu `PREFIX-KỆ-`) — 3D vẽ thùng carton đúng chỗ có hàng. */
export async function listShelfStock(
  input: { warehouseId: string; locationCode: string },
  signal?: AbortSignal,
) {
  const { data } = await api.get<unknown>(INVENTORY_API.warehouseStockItems(input.warehouseId), {
    params: { location: `${input.locationCode}-`, page: 0, size: LIMITS.shelfStockSize },
    signal,
  });
  return locationStockDto.parse(data).items;
}
