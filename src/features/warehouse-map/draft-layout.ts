/**
 * Bố cục để XEM 3D bản nháp chế độ sửa (docs 06 §4.1) — dựng `WarehouseLayout` từ bản nháp chưa lưu, để cảnh 3D
 * vẽ đúng hình người dùng đang vẽ / dời / sửa mà không gọi BE. Thuần.
 *
 * - Kệ / khu vực đã lưu: giữ tầng, bin, trạng thái, mã vị trí của bản đã lưu; lấy vị trí, kích thước, mã, tên, zone
 *   theo bản nháp. Bin có toạ độ TƯƠNG ĐỐI trong kệ nên dời kệ thì bin đi theo.
 * - Kệ mới: dựng tầng + lưới bin theo thông số dựng (`ShelfBuild`) như BE sẽ làm khi lưu (`AddLevel` × N rồi
 *   `GenerateBins`, BR-14): cao độ tầng = (chỉ số − 1) × cao tầng, bin chia đều bề rộng (cột) × chiều sâu (hàng).
 * - Hình chưa lưu không có mã vị trí thật → mã `draft:` để không trùng dòng tồn nào (bản đồ chỉ trực quan, BR-05).
 * - Hình đã xoá trong bản nháp (`removed`) không vẽ.
 */

import { LOCATION_STATUS } from "@/constants";

import type { DraftArea, DraftBoundary, DraftShelf, MapDraft, ShelfBuild } from "./draft-types";
import type { Boundary, LayoutArea, LayoutLevel, LayoutShelf, WarehouseLayout } from "./types";

const ACTIVE = LOCATION_STATUS.ACTIVE;

/** Mã vị trí tạm của hình chưa lưu — không khớp dòng tồn nào. */
export const draftLocationCode = (key: string, ...parts: (string | number)[]) =>
  ["draft", key, ...parts].join(":");

/** Tầng + lưới bin của kệ mới, theo thông số dựng. */
export function draftLevels(
  key: string,
  width: number,
  length: number,
  build: ShelfBuild,
): LayoutLevel[] {
  return Array.from({ length: build.levelCount }, (_, i) => {
    const levelIndex = i + 1;
    const bins = build.generateBins
      ? Array.from({ length: build.rowCount * build.columnCount }, (_, n) => {
          const [row, column] = [Math.floor(n / build.columnCount), n % build.columnCount];
          const [w, l] = [width / build.columnCount, length / build.rowCount];
          const code = String(n + 1);
          return {
            id: draftLocationCode(key, levelIndex, code),
            code,
            description: null,
            footprint: { x: column * w, y: row * l, width: w, length: l, rotation: 0 },
            type: build.binType,
            locationId: draftLocationCode(key, levelIndex, code),
            locationCode: draftLocationCode(key, levelIndex, code),
            maxWeight: build.maxWeight,
            pickable: build.pickable,
            putawayTarget: build.putawayTarget,
            status: ACTIVE,
            effectiveStatus: ACTIVE,
            usable: true,
          };
        })
      : [];
    return {
      id: draftLocationCode(key, levelIndex),
      levelIndex,
      elevation: i * build.levelHeight,
      usableHeight: build.levelHeight,
      maxWeight: null,
      bins,
    };
  });
}

function shelfOf(item: DraftShelf, saved: LayoutShelf | undefined): LayoutShelf {
  const drawn = {
    zoneId: item.zoneKey,
    code: item.code,
    name: item.name,
    description: item.description,
    footprint: item.footprint,
    obstacle: item.obstacle,
    pickFaces: item.pickFaces,
  };
  if (saved) return { ...saved, ...drawn };
  const build = item.build ?? item.copyBuild;
  return {
    id: item.key,
    ...drawn,
    status: ACTIVE,
    effectiveStatus: ACTIVE,
    version: 0,
    levels: build ? draftLevels(item.key, item.footprint.width, item.footprint.length, build) : [],
  };
}

function areaOf(item: DraftArea, saved: LayoutArea | undefined): LayoutArea {
  const drawn = {
    code: item.code,
    type: item.type,
    name: item.name,
    footprint: item.footprint,
    obstacle: item.obstacle,
    maxWeight: item.location.maxWeight,
    pickable: item.location.pickable,
    putawayTarget: item.location.putawayTarget,
  };
  if (saved) return { ...saved, ...drawn };
  return {
    id: item.key,
    ...drawn,
    status: ACTIVE,
    effectiveStatus: ACTIVE,
    usable: true,
    version: 0,
    locationId: null,
    locationCode: null,
  };
}

const boundaryOf = (item: DraftBoundary, saved: Boundary | undefined): Boundary => ({
  id: item.key,
  type: item.type,
  startX: item.startX,
  startY: item.startY,
  endX: item.endX,
  endY: item.endY,
  passable: item.passable,
  operationalStatus: item.operationalStatus,
  version: saved?.version ?? 0,
});

export function layoutFromDraft(layout: WarehouseLayout, draft: MapDraft): WarehouseLayout {
  const byId = <T extends { id: string }>(rows: readonly T[]) =>
    new Map(rows.map((r) => [r.id, r]));
  const [shelves, areas, boundaries] = [
    byId(layout.shelves),
    byId(layout.areas),
    byId(layout.boundaries),
  ];
  const saved = <T>(map: Map<string, T>, id: string | null) =>
    id === null ? undefined : map.get(id);
  const result: WarehouseLayout = {
    warehouse: layout.warehouse,
    zones: draft.zones.map((zone) => ({
      id: zone.key,
      name: zone.name,
      color: zone.color,
      version: zone.version,
    })),
    shelves: [],
    areas: [],
    boundaries: [],
  };
  for (const item of draft.items) {
    if (item.kind === "shelf") result.shelves.push(shelfOf(item, saved(shelves, item.id)));
    else if (item.kind === "area") result.areas.push(areaOf(item, saved(areas, item.id)));
    else result.boundaries.push(boundaryOf(item, saved(boundaries, item.id)));
  }
  return result;
}
