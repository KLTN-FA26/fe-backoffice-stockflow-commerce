import { boxOf } from "./selectors";

import type { MapBox } from "./selectors";
import type { LayoutShelf, WarehouseLayout } from "./types";

const norm = (code: string) => code.trim().toUpperCase();

/** Kệ / khu trên mặt bằng chứa ít nhất một mã vị trí (bin của kệ, hoặc mã của khu) — id + khung vẽ. */
export interface PlaceMark {
  id: string;
  box: MapBox;
}

function shelfHolds(shelf: LayoutShelf, codes: ReadonlySet<string>): boolean {
  return shelf.levels.some((level) => level.bins.some((bin) => codes.has(norm(bin.locationCode))));
}

/**
 * Chỗ trên mặt bằng 2D của các mã vị trí: bin → cả kệ chứa nó (2D không vẽ tầng), khu → chính khu. Mã không có trên
 * bản đồ thì bỏ qua. Không trùng.
 */
export function placesOf(layout: WarehouseLayout, codes: readonly string[]): PlaceMark[] {
  const wanted = new Set(codes.map(norm).filter(Boolean));
  if (wanted.size === 0) return [];
  return [
    ...layout.shelves
      .filter((shelf) => shelfHolds(shelf, wanted))
      .map((shelf) => ({ id: shelf.id, box: boxOf(shelf.footprint) })),
    ...layout.areas
      .filter((area) => area.locationCode && wanted.has(norm(area.locationCode)))
      .map((area) => ({ id: area.id, box: boxOf(area.footprint) })),
  ];
}

/** Kệ chứa bin có mã này — để mở sẵn lưới bin khi đích đang là một bin. */
export function shelfOfLocation(layout: WarehouseLayout, code: string): LayoutShelf | undefined {
  const wanted = norm(code);
  if (wanted === "") return undefined;
  return layout.shelves.find((shelf) => shelfHolds(shelf, new Set([wanted])));
}

/** Mã vị trí của khu (khu NON_STORAGE không có), hoặc `null`. */
export function areaLocationCode(layout: WarehouseLayout, areaId: string): string | null {
  const code = layout.areas.find((area) => area.id === areaId)?.locationCode;
  return code ? norm(code) : null;
}
