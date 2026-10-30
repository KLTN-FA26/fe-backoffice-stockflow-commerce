/**
 * Hình học và số liệu dẫn xuất của bản đồ kho — thuần, không side effect. Quy ước như BE `Footprint`:
 * (x, y) là góc trên-trái SAU khi xoay; quay 90 / 270 đổi chỗ hai cạnh; chạm cạnh không tính chồng lấn.
 */

import { LOCATION_STATUS, WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import type {
  Footprint,
  LayoutArea,
  LayoutBin,
  LayoutLevel,
  LayoutShelf,
  WarehouseLayout,
} from "./types";

/** Hộp thẳng trục trên mặt bằng (mét). */
export interface MapBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const isQuarterTurned = (rotation: number) => rotation === 90 || rotation === 270;

/** Footprint → hộp trên mặt bằng (BE `effectiveWidth` chạy theo x, `effectiveLength` theo y). */
export function boxOf(footprint: Footprint): MapBox {
  const turned = isQuarterTurned(footprint.rotation);
  return {
    x: footprint.x,
    y: footprint.y,
    w: turned ? footprint.length : footprint.width,
    h: turned ? footprint.width : footprint.length,
  };
}

/** BR-07: chồng lấn chặt — hai kệ đặt lưng nhau (chạm cạnh) KHÔNG chồng lấn. */
export function boxesOverlap(a: MapBox, b: MapBox): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** BR-06: nằm trong khung gốc (0, 0); chạm mép tính là bên trong. */
export function fitsWithin(box: MapBox, frameWidth: number, frameHeight: number): boolean {
  return box.x >= 0 && box.y >= 0 && box.x + box.w <= frameWidth && box.y + box.h <= frameHeight;
}

/**
 * BR-07: mã kệ / khu vực ĐANG dùng (không INACTIVE) đầu tiên chồng lấn `box`, hoặc `null`.
 * Dùng `status` (người dùng đặt), không phải `effectiveStatus` — như BE khi lưu.
 */
export function overlappingCode(
  box: MapBox,
  layout: Pick<WarehouseLayout, "shelves" | "areas">,
): string | null {
  const placed: { code: string; status: string; footprint: Footprint }[] = [
    ...layout.shelves,
    ...layout.areas,
  ];
  const hit = placed.find(
    (place) =>
      place.status !== LOCATION_STATUS.INACTIVE && boxesOverlap(box, boxOf(place.footprint)),
  );
  return hit?.code ?? null;
}

/**
 * Phép đặt khung cục bộ của kệ lên mặt bằng (SVG `translate` rồi `rotate`, quay theo chiều kim
 * đồng hồ): mặt Bắc là cạnh trên khi rotation 0, cạnh phải khi 90 (docs map2d §3.3).
 */
export function shelfTransform(footprint: Footprint): { tx: number; ty: number; deg: number } {
  const { x, y, width, length, rotation } = footprint;
  switch (rotation) {
    case 90:
      return { tx: x + length, ty: y, deg: 90 };
    case 180:
      return { tx: x + width, ty: y + length, deg: 180 };
    case 270:
      return { tx: x, ty: y + width, deg: 270 };
    default:
      return { tx: x, ty: y, deg: 0 };
  }
}

/** Tầng thấp nhất có bin — mặt bằng 2D chia ô theo tầng này (bin các tầng cùng toạ độ x, y). */
export function planLevel(shelf: Pick<LayoutShelf, "levels">): LayoutLevel | undefined {
  return [...shelf.levels]
    .sort((a, b) => a.levelIndex - b.levelIndex)
    .find((level) => level.bins.length > 0);
}

/** BR-14: kích thước bin = cạnh kệ ÷ số cột / hàng, làm tròn XUỐNG tới milimét. */
export function generatedBinSize(
  shelfWidth: number,
  shelfLength: number,
  rows: number,
  columns: number,
): { width: number; length: number } {
  const floorMm = (value: number) => Math.floor(value * 1000 + 1e-9) / 1000;
  return { width: floorMm(shelfWidth / columns), length: floorMm(shelfLength / rows) };
}

/**
 * Cao độ và chiều cao vẽ 3D của một tầng. Thiếu số đo (đều tuỳ chọn) → xếp đều theo
 * `defaultLevelHeight` — chỉ để vẽ, không gửi về BE.
 */
export function levelSpan(level: Pick<LayoutLevel, "levelIndex" | "elevation" | "usableHeight">): {
  bottom: number;
  height: number;
} {
  const fallbackBottom = (level.levelIndex - 1) * LIMITS.defaultLevelHeight;
  return {
    bottom: level.elevation ?? fallbackBottom,
    height: level.usableHeight ?? LIMITS.defaultLevelHeight * 0.9,
  };
}

/** Đỉnh cao nhất của kệ (m) — đặt chiều cao khung kệ 3D. */
export function shelfHeight(shelf: Pick<LayoutShelf, "levels">): number {
  const tops = shelf.levels.map((level) => {
    const span = levelSpan(level);
    return span.bottom + span.height;
  });
  return Math.max(LIMITS.defaultLevelHeight, ...tops);
}

export interface LayoutStats {
  shelves: number;
  bins: number;
  usableBins: number;
  areas: number;
}

/** Số liệu đầu bản đồ — đếm cả vị trí INACTIVE (bản đồ trả đủ), "dùng được" theo BE `usable`. */
export function layoutStats(layout: WarehouseLayout): LayoutStats {
  const bins: LayoutBin[] = layout.shelves.flatMap((shelf) =>
    shelf.levels.flatMap((level) => level.bins),
  );
  return {
    shelves: layout.shelves.length,
    bins: bins.length,
    usableBins: bins.filter((bin) => bin.usable).length,
    areas: layout.areas.length,
  };
}

export const isLayoutEmpty = (layout: WarehouseLayout): boolean =>
  layout.shelves.length + layout.areas.length + layout.boundaries.length === 0;

/** Màu zone theo id — màu là dữ liệu BE (`#RRGGBB`), vắng = kệ không tô màu zone. */
export function zoneColors(layout: Pick<WarehouseLayout, "zones">): Map<string, string> {
  return new Map(
    layout.zones.flatMap((zone) => (zone.color ? [[zone.id, zone.color] as const] : [])),
  );
}

/** Kệ hoặc khu vực theo id — panel chi tiết đọc theo `?selected=`. */
export function findPlace(
  layout: WarehouseLayout,
  id: string | null,
): { kind: "shelf"; shelf: LayoutShelf } | { kind: "area"; area: LayoutArea } | null {
  if (!id) return null;
  const shelf = layout.shelves.find((item) => item.id === id);
  if (shelf) return { kind: "shelf", shelf };
  const area = layout.areas.find((item) => item.id === id);
  return area ? { kind: "area", area } : null;
}

/** BR-10: ví dụ mã bin `PREFIX-A01-1-01` để người tạo kho thấy prefix sẽ nằm ở đâu. */
export const exampleBinCode = (prefix: string): string =>
  `${prefix.trim().toUpperCase() || "PREFIX"}-A01-1-01`;

/** Số có không quá `digits` chữ số thập phân — BE từ chối giá trị lẻ hơn, không làm tròn. */
export function hasAtMostDecimals(value: number, digits: number): boolean {
  const scaled = value * 10 ** digits;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}
