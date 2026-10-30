/**
 * Bản nháp của chế độ sửa bản đồ (docs 06 §4.1): mọi hình vẽ / kéo / chỉnh thông số chỉ nằm ở client
 * tới khi bấm Lưu — lúc đó `draft-plan.ts` so bản nháp với bản đã lưu để ra danh sách request.
 * Hàm thuần, không side effect. Kệ / khu vực INACTIVE không vào bản nháp (không sửa, không chặn chỗ).
 */

import { AREA_TYPE, LOCATION_STATUS, WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { boxOf } from "./selectors";
import { shelfTemplate } from "./shelf-template";

import type {
  DraftArea,
  DraftBoundary,
  DraftItem,
  DraftShelf,
  DraftZone,
  MapDraft,
  ShelfBuild,
} from "./draft-types";
import type { Boundary, LayoutArea, LayoutShelf, WarehouseLayout } from "./types";

export type {
  AreaLocation,
  DraftArea,
  DraftBoundary,
  DraftItem,
  DraftPlace,
  DraftShelf,
  DraftZone,
  MapDraft,
  ShelfBuild,
} from "./draft-types";

/** Phần gửi về BE của một hình / zone — khoá, id, version và số đo phụ không tính là "thay đổi". */
export function snapshot(value: DraftItem | DraftZone): string {
  const { key: _k, id: _i, version: _v, ...rest } = value;
  if ("kind" in rest && rest.kind === "shelf") {
    const { binExtent: _e, hasPickableBins: _p, copyBuild: _c, ...editable } = rest;
    return JSON.stringify(editable);
  }
  if ("kind" in rest && rest.kind === "area") {
    const { wasStorage: _s, ...editable } = rest;
    return JSON.stringify(editable);
  }
  return JSON.stringify(rest);
}

/** Phạm vi bin của kệ trong khung cục bộ (trước khi xoay) — mọi tầng, kể cả bin INACTIVE. */
function binExtentOf(shelf: LayoutShelf): DraftShelf["binExtent"] {
  const bins = shelf.levels.flatMap((level) => level.bins);
  if (bins.length === 0) return null;
  return bins.reduce(
    (extent, bin) => {
      const box = boxOf(bin.footprint);
      return {
        width: Math.max(extent.width, box.x + box.w),
        length: Math.max(extent.length, box.y + box.h),
      };
    },
    { width: 0, length: 0 },
  );
}

const shelfOf = (shelf: LayoutShelf): DraftShelf => ({
  kind: "shelf",
  key: shelf.id,
  id: shelf.id,
  version: shelf.version,
  code: shelf.code,
  name: shelf.name,
  description: shelf.description ?? null,
  zoneKey: shelf.zoneId ?? null,
  footprint: { ...shelf.footprint },
  obstacle: shelf.obstacle,
  pickFaces: { ...shelf.pickFaces },
  defaultStorageClass: shelf.defaultStorageClass,
  build: null,
  copyBuild: shelfTemplate(shelf, DEFAULT_SHELF_BUILD),
  binExtent: binExtentOf(shelf),
  hasPickableBins: shelf.levels.some((level) => level.bins.some((bin) => bin.pickable)),
});

const areaOf = (area: LayoutArea): DraftArea => ({
  kind: "area",
  key: area.id,
  id: area.id,
  version: area.version,
  code: area.code,
  type: area.type,
  name: area.name,
  footprint: { ...area.footprint },
  obstacle: area.obstacle,
  location: {
    storageClass: area.storageClass ?? "NORMAL",
    capacityUnits: area.capacityUnits ?? null,
    maxWeight: area.maxWeight ?? null,
    pickable: area.pickable ?? false,
    putawayTarget: area.putawayTarget ?? false,
  },
  wasStorage: area.type !== AREA_TYPE.NON_STORAGE,
});

const boundaryOf = (b: Boundary): DraftBoundary => ({
  kind: "boundary",
  key: b.id,
  id: b.id,
  version: b.version,
  type: b.type,
  startX: b.startX,
  startY: b.startY,
  endX: b.endX,
  endY: b.endY,
  passable: b.passable,
  operationalStatus: b.operationalStatus ?? null,
});

export function draftFromLayout(layout: WarehouseLayout): MapDraft {
  const live = <T extends { status: string }>(rows: T[]) =>
    rows.filter((row) => row.status !== LOCATION_STATUS.INACTIVE);
  const inactive = <T extends { status: string; code: string }>(rows: T[]) =>
    rows.filter((row) => row.status === LOCATION_STATUS.INACTIVE).map((row) => row.code);
  const zones = layout.zones.map((z) => ({ ...z, key: z.id, color: z.color ?? null }));
  const items: DraftItem[] = [
    ...live(layout.areas).map(areaOf),
    ...live(layout.shelves).map(shelfOf),
    ...layout.boundaries.map(boundaryOf),
  ];
  const base = Object.fromEntries([...zones, ...items].map((v) => [v.key, snapshot(v)]));
  const inactiveCodes = { shelf: inactive(layout.shelves), area: inactive(layout.areas) };
  return { zones, items, removed: [], base, inactiveCodes, seq: 0 };
}

export const isChanged = (draft: MapDraft, value: DraftItem | DraftZone): boolean =>
  value.id === null || draft.base[value.key] !== snapshot(value);

/** Số request sẽ gửi khi lưu — mỗi hình / zone mới hoặc đã sửa, mỗi hình đã lưu bị xoá. */
export const changeCount = (draft: MapDraft): number =>
  [...draft.zones, ...draft.items].filter((v) => isChanged(draft, v)).length + draft.removed.length;

/** Mã kệ / khu vực đã dùng trong kho: trong bản nháp, vừa xoá, và của vị trí INACTIVE (BR-13). */
export const usedCodes = (draft: MapDraft, kind: "shelf" | "area"): string[] => [
  ...[...draft.items, ...draft.removed].flatMap((item) => (item.kind === kind ? [item.code] : [])),
  ...draft.inactiveCodes[kind],
];

/** Mã gợi ý cho hình vừa vẽ: `K01`, `K02`… bỏ qua mã đã dùng (kể cả của vị trí INACTIVE, BR-13). */
export function nextCode(base: string, used: Iterable<string>): string {
  const taken = new Set([...used].map((code) => code.toUpperCase()));
  for (let n = 1; ; n += 1) {
    const code = `${base}${String(n).padStart(2, "0")}`;
    if (!taken.has(code)) return code;
  }
}

export const DEFAULT_SHELF_BUILD: ShelfBuild = {
  levelCount: LIMITS.defaultLevelCount,
  levelHeight: LIMITS.defaultLevelHeight,
  generateBins: true,
  rowCount: LIMITS.defaultBinRows,
  columnCount: LIMITS.defaultBinColumns,
  namingScheme: "SEQUENTIAL",
  binType: "STANDARD",
  capacityUnits: null,
  maxWeight: null,
  pickable: true,
  putawayTarget: true,
};
