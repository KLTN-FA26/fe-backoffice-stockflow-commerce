/**
 * Dựng `WarehouseLayoutResponse` của BE từ store mock module 06: mọi vị trí kể cả INACTIVE, kèm
 * `effectiveStatus` = hẹp nhất của kho / kệ / vị trí (docs 06 §4.2, BR-16) và `usable` = effectiveStatus
 * ACTIVE. Trường null bị bỏ khỏi JSON như BE (`non_null`). Chỉ dùng khi USE_MOCK=true.
 */

import { omitNulls } from "./mock-route-utils";
import { getWarehouseStore, narrowest } from "./mock-warehouse-store";

import type { MockLocationStatus } from "./mock-warehouse-store";

/** Bản đồ của kho trong store, hoặc `null` nếu kho không thuộc store (kho cũ của mock-data). */
export function mockStoredLayout(warehouseId: string): unknown {
  const store = getWarehouseStore();
  const warehouse = store.warehouses.get(warehouseId);
  if (!warehouse) return null;
  const own = <T extends { warehouseId: string }>(rows: T[]) =>
    rows.filter((row) => row.warehouseId === warehouseId);
  const warehouseStatus: MockLocationStatus = warehouse.status === "ACTIVE" ? "ACTIVE" : "INACTIVE";

  const shelves = own(store.shelves).map(({ warehouseId: _w, ...shelf }) => {
    const shelfEffective = narrowest(warehouseStatus, shelf.status);
    return {
      ...shelf,
      effectiveStatus: shelfEffective,
      levels: [...shelf.levels]
        .sort((a, b) => a.levelIndex - b.levelIndex)
        .map((level) => ({
          ...level,
          bins: level.bins.map((bin) => {
            const effectiveStatus = narrowest(shelfEffective, bin.status);
            return { ...bin, effectiveStatus, usable: effectiveStatus === "ACTIVE" };
          }),
        })),
    };
  });

  const areas = own(store.areas).map(({ warehouseId: _w, location, ...area }) => {
    const effectiveStatus = narrowest(warehouseStatus, area.status);
    // NON_STORAGE: không có trường vị trí và không có `usable`
    return location
      ? { ...area, ...location, effectiveStatus, usable: effectiveStatus === "ACTIVE" }
      : { ...area, effectiveStatus };
  });

  const strip = <T extends { warehouseId: string }>(rows: T[]) =>
    own(rows).map(({ warehouseId: _w, ...row }) => row);

  return omitNulls({
    warehouse: {
      id: warehouse.id,
      prefix: warehouse.prefix,
      name: warehouse.name,
      mapUnit: warehouse.mapUnit,
      mapWidth: warehouse.mapWidth,
      mapHeight: warehouse.mapHeight,
      status: warehouse.status,
      version: warehouse.version,
    },
    zones: strip(store.zones).sort((a, b) => a.name.localeCompare(b.name, "vi")),
    shelves,
    areas,
    boundaries: strip(store.boundaries),
  });
}
