/**
 * Kiểu dữ liệu bản nháp chế độ sửa bản đồ (docs 06 §4.1) — xem `draft.ts` cho các hàm dựng / so sánh.
 */

import type { BIN_NAMING_SCHEMES } from "@/constants";

import type { Footprint, LayoutArea, LayoutBin, LayoutShelf, Boundary } from "./types";

type StorageClass = LayoutShelf["defaultStorageClass"];

/** Tầng + bin tạo cùng kệ mới (`AddLevel` × N rồi `GenerateBins`, BR-14) — kệ đã lưu thì `null`. */
export interface ShelfBuild {
  levelCount: number;
  levelHeight: number;
  generateBins: boolean;
  rowCount: number;
  columnCount: number;
  namingScheme: (typeof BIN_NAMING_SCHEMES)[number];
  binType: LayoutBin["type"];
  capacityUnits: number | null;
  maxWeight: number | null;
  pickable: boolean;
  putawayTarget: boolean;
}

export interface AreaLocation {
  storageClass: StorageClass;
  capacityUnits: number | null;
  maxWeight: number | null;
  pickable: boolean;
  putawayTarget: boolean;
}

/** `id` null = chưa lưu; `version` là bản đọc gần nhất (PUT gửi lại, cũ thì 409 OPTIMISTIC_LOCK). */
interface Saved {
  key: string;
  id: string | null;
  version: number;
}

export interface DraftShelf extends Saved {
  kind: "shelf";
  code: string;
  name: string;
  description: string | null;
  /** Khoá zone trong bản nháp — zone đã lưu dùng id làm khoá. */
  zoneKey: string | null;
  footprint: Footprint;
  obstacle: boolean;
  pickFaces: LayoutShelf["pickFaces"];
  defaultStorageClass: StorageClass;
  build: ShelfBuild | null;
  /** Kệ đã lưu: thông số dựng lại y hệt (`shelfTemplate`) — bản sao Ctrl+D / Ctrl+V dùng cái này. */
  copyBuild?: ShelfBuild;
  /** Kệ đã lưu nhưng dựng tầng / bin hỏng giữa chừng: tầng đã tạo — lần lưu sau dựng tiếp phần thiếu. */
  builtLevelIds?: string[];
  /** Kệ đã lưu: phạm vi bin trong khung kệ (kệ không thu nhỏ quá, BR-07) và có bin cho lấy hàng (BR-08). */
  binExtent: { width: number; length: number } | null;
  hasPickableBins: boolean;
}

export interface DraftArea extends Saved {
  kind: "area";
  code: string;
  type: LayoutArea["type"];
  name: string;
  footprint: Footprint;
  obstacle: boolean;
  location: AreaLocation;
  /** Khu đã lưu là khu chứa hàng — không đổi được thành NON_STORAGE (BR-11). */
  wasStorage: boolean;
}

export interface DraftBoundary extends Saved {
  kind: "boundary";
  type: Boundary["type"];
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  passable: boolean;
  operationalStatus: "OPEN" | "CLOSED" | null;
}

export type DraftItem = DraftShelf | DraftArea | DraftBoundary;
export type DraftPlace = DraftShelf | DraftArea;

export interface DraftZone extends Saved {
  name: string;
  color: string | null;
}

export interface MapDraft {
  zones: DraftZone[];
  items: DraftItem[];
  /** Hình đã lưu bị xoá trong bản nháp: kệ / khu vực → Inactive, tường / cửa → DELETE (BR-04). */
  removed: DraftItem[];
  /** Ảnh chụp phần sửa được của bản đã lưu, theo `key` — khác ảnh hiện tại = có thay đổi. */
  base: Record<string, string>;
  /** Mã của kệ / khu vực INACTIVE — không vào bản nháp nhưng không cấp lại (BR-13). */
  inactiveCodes: { shelf: string[]; area: string[] };
  seq: number;
}
