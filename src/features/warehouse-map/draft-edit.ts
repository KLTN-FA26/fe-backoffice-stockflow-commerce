/**
 * Reducer bản nháp bản đồ — thuần, không side effect. Vẽ trên canvas tạo hình mới với thông số gợi ý,
 * bảng thông số sửa từng trường, xoá hình (hình đã lưu chỉ đánh dấu, BR-04), lưu xong ghi nhận id mới.
 */

import { BOUNDARY_TYPE, UI_LABELS } from "@/constants";

import { DEFAULT_SHELF_BUILD, draftFromLayout, newKeyOf, nextCode, usedCodes } from "./draft";
import { duplicatedItem } from "./draft-duplicate";
import { withoutKeys, withPasted } from "./draft-group";
import { synced } from "./draft-sync";

import type { DraftArea, DraftBoundary, DraftItem, DraftShelf, MapDraft } from "./draft";
import type { SavedRef } from "./draft-sync";
import type { MapBox } from "./selectors";
import type { WarehouseLayout } from "./types";

const D = UI_LABELS.warehouseMap.edit.defaults;

export interface MapLine {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/** Công cụ của chế độ sửa: chọn / di chuyển, bàn tay (kéo bản đồ), hoặc kéo trên nền để vẽ một loại hình. */
export const DRAFT_TOOLS = ["select", "pan", "shelf", "area", "wall", "door"] as const;
export type DraftTool = (typeof DRAFT_TOOLS)[number];

/** Hình vừa kéo xong trên canvas (mét, đã bám lưới). */
export type DrawnShape =
  { kind: "shelf" | "area"; box: MapBox } | { kind: "wall" | "door"; line: MapLine };

export type { SavedRef };

export type DraftAction =
  | { type: "reset"; layout: WarehouseLayout }
  | { type: "draw"; shape: DrawnShape }
  | { type: "update"; key: string; apply: (item: DraftItem) => DraftItem }
  | { type: "remove"; key: string }
  | { type: "addZone"; name: string; color: string | null }
  | { type: "duplicate"; key: string }
  /** Ctrl+V: dán hình đã sao chép (Ctrl+C) — hình mới đặt ngay dưới hình được sao chép. */
  | { type: "paste"; item: DraftItem }
  /** Chọn vùng: xoá / dán cả nhóm thành MỘT bước hoàn tác. */
  | { type: "removeMany"; keys: string[] }
  | { type: "pasteMany"; items: DraftItem[] }
  | { type: "synced"; saved: SavedRef[]; removedKeys: string[] };

/** Khoá của hình vừa tạo — giữ export ở đây cho nơi đang dùng. */
export { newKeyOf };

function drawnItem(draft: MapDraft, shape: DrawnShape, key: string): DraftItem {
  const meta = { key, id: null, version: 0 };
  if ("line" in shape) {
    const door = shape.kind === "door";
    return {
      ...meta,
      kind: "boundary",
      ...shape.line,
      type: door ? BOUNDARY_TYPE.DOOR : BOUNDARY_TYPE.WALL,
      // Tường luôn không đi qua được, không có trạng thái (BoundaryRequests)
      passable: door,
      operationalStatus: door ? "OPEN" : null,
    } satisfies DraftBoundary;
  }
  const footprint = {
    x: shape.box.x,
    y: shape.box.y,
    width: shape.box.w,
    length: shape.box.h,
    rotation: 0,
  };
  const used = (kind: "shelf" | "area") => usedCodes(draft, kind);
  if (shape.kind === "area") {
    const code = nextCode(D.areaCodeBase, used("area"));
    return {
      ...meta,
      kind: "area",
      code,
      type: "RECEIVING",
      name: D.areaName(code),
      footprint,
      obstacle: false,
      location: {
        storageClass: "NORMAL",
        capacityUnits: null,
        maxWeight: null,
        pickable: false,
        putawayTarget: false,
      },
      wasStorage: false,
    } satisfies DraftArea;
  }
  const code = nextCode(D.shelfCodeBase, used("shelf"));
  return {
    ...meta,
    kind: "shelf",
    code,
    name: D.shelfName(code),
    description: null,
    zoneKey: null,
    footprint,
    obstacle: true,
    // Mặt dài phía nam lấy hàng như kệ demo; BR-08 cần ≥ 1 mặt khi bin cho lấy hàng
    pickFaces: { north: false, east: false, south: true, west: false },
    defaultStorageClass: "NORMAL",
    build: { ...DEFAULT_SHELF_BUILD },
    binExtent: null,
    hasPickableBins: false,
  } satisfies DraftShelf;
}

export function draftReducer(draft: MapDraft, action: DraftAction): MapDraft {
  switch (action.type) {
    case "reset":
      return draftFromLayout(action.layout);
    case "draw": {
      const item = drawnItem(draft, action.shape, newKeyOf(draft));
      return { ...draft, items: [...draft.items, item], seq: draft.seq + 1 };
    }
    case "update":
      return {
        ...draft,
        items: draft.items.map((item) => (item.key === action.key ? action.apply(item) : item)),
      };
    case "remove":
      return withoutKeys(draft, [action.key]);
    case "duplicate":
    case "paste": {
      const source =
        action.type === "paste" ? action.item : draft.items.find((item) => item.key === action.key);
      if (!source) return draft;
      const copy = duplicatedItem(draft, source, newKeyOf(draft));
      return { ...draft, items: [...draft.items, copy], seq: draft.seq + 1 };
    }
    case "removeMany":
      return withoutKeys(draft, action.keys);
    case "pasteMany":
      return withPasted(draft, action.items);
    case "addZone": {
      const zone = {
        key: newKeyOf(draft),
        id: null,
        version: 0,
        name: action.name,
        color: action.color,
      };
      return { ...draft, zones: [...draft.zones, zone], seq: draft.seq + 1 };
    }
    case "synced":
      return synced(draft, action.saved, action.removedKeys);
  }
}
