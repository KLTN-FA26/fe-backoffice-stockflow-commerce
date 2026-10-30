/**
 * Form thêm kệ (kèm tầng + tự sinh bin) và thêm khu vực — `ShelfRequests.CreateShelf` / `AddLevel` /
 * `GenerateBins`, `AreaRequests.CreateArea` (docs 06 §4.1 bước 4–7). Schema là factory vì BR-06 / BR-07
 * cần khung và bố cục hiện có. FE kiểm trước — Backend phải re-check (409 LAYOUT_*, PICK_FACE_REQUIRED).
 */

import { z } from "zod";

import {
  AREA_TYPE,
  AREA_TYPES,
  BIN_NAMING_SCHEMES,
  BIN_TYPES,
  STORAGE_CLASSES,
  UI_LABELS,
  WAREHOUSE_MAP_LIMITS as LIMITS,
} from "@/constants";

import { locationPart, measure, optionalPositive } from "./input-schemas";
import { boxOf, fitsWithin, overlappingCode } from "./selectors";

import type { WarehouseLayout } from "./types";

const V = UI_LABELS.warehouseMap.validation;

/** BR-09 (docs 06 §6): góc xoay chỉ 0 / 90 / 180 / 270. */
const ROTATIONS = ["0", "90", "180", "270"] as const;

const count = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, message)
    .transform(Number)
    .refine((value) => value >= min && value <= max, message);

const placement = {
  x: measure({ positive: false }),
  y: measure({ positive: false }),
  width: measure({ positive: true }),
  length: measure({ positive: true }),
  rotation: z.enum(ROTATIONS).transform(Number),
  obstacle: z.boolean(),
};

const locationFields = {
  capacityUnits: optionalPositive({ integer: true }),
  maxWeight: optionalPositive({ integer: false }),
  pickable: z.boolean(),
  putawayTarget: z.boolean(),
};

type Placed = { x: number; y: number; width: number; length: number; rotation: number };

/** BR-06 + BR-07 cho một hình mới đặt lên bản đồ — gắn lỗi vào ô X. */
function checkPlacement(layout: WarehouseLayout, value: Placed, ctx: z.RefinementCtx) {
  const box = boxOf(value);
  // BR-06 (docs 06 §6): nằm trong khung bản đồ, chạm mép tính là bên trong
  if (!fitsWithin(box, layout.warehouse.mapWidth, layout.warehouse.mapHeight)) {
    ctx.addIssue({ code: "custom", message: V.outOfBounds, path: ["x"] });
    return;
  }
  // BR-07 (docs 06 §6): không chồng lấn kệ / khu vực đang không INACTIVE (chạm cạnh được)
  const hit = overlappingCode(box, layout);
  if (hit) ctx.addIssue({ code: "custom", message: V.overlap(hit), path: ["x"] });
}

/* ── Kệ + tầng + tự sinh bin ───────────────────────────────────────────── */

export function shelfCreateSchema(layout: WarehouseLayout) {
  const codes = new Set(layout.shelves.map((shelf) => shelf.code.toUpperCase()));
  return z
    .object({
      code: locationPart(LIMITS.codeMax, V.codeFormat).refine(
        (code) => !codes.has(code),
        V.codeTaken,
      ),
      name: z.string().trim().min(1, V.required).max(LIMITS.nameMax, V.tooLong(LIMITS.nameMax)),
      zoneId: z.string(),
      ...placement,
      north: z.boolean(),
      east: z.boolean(),
      south: z.boolean(),
      west: z.boolean(),
      defaultStorageClass: z.enum(STORAGE_CLASSES),
      // BR-15 (docs 06 §6): tối đa 20 tầng mỗi kệ
      levelCount: count(0, LIMITS.levelsPerShelfMax, V.levelsMax),
      levelHeight: measure({ positive: true }),
      generateBins: z.boolean(),
      rowCount: count(1, LIMITS.binsPerLevelMax, V.binsMax),
      columnCount: count(1, LIMITS.binsPerLevelMax, V.binsMax),
      namingScheme: z.enum(BIN_NAMING_SCHEMES),
      binType: z.enum(BIN_TYPES),
      ...locationFields,
    })
    .superRefine((value, ctx) => {
      checkPlacement(layout, value, ctx);
      if (!value.generateBins || value.levelCount === 0) return;
      // BR-14 (docs 06 §6): hàng × cột ≤ 200 bin mỗi tầng
      if (value.rowCount * value.columnCount > LIMITS.binsPerLevelMax)
        ctx.addIssue({ code: "custom", message: V.binsMax, path: ["columnCount"] });
      // BR-14: kiểu ROW_LETTER_COLUMN dùng chữ A–Z cho hàng → tối đa 26 hàng
      if (value.namingScheme === "ROW_LETTER_COLUMN" && value.rowCount > LIMITS.letterRowsMax)
        ctx.addIssue({ code: "custom", message: V.letterRowsMax, path: ["rowCount"] });
      // BR-08 (docs 06 §6): kệ có bin cho lấy hàng phải có ít nhất một mặt lấy hàng
      if (value.pickable && !(value.north || value.east || value.south || value.west))
        ctx.addIssue({ code: "custom", message: V.pickFaceRequired, path: ["north"] });
    });
}

export type ShelfCreateInput = z.input<ReturnType<typeof shelfCreateSchema>>;
export type ShelfCreateValues = z.output<ReturnType<typeof shelfCreateSchema>>;

export const EMPTY_SHELF_FORM: ShelfCreateInput = {
  code: "",
  name: "",
  zoneId: "",
  x: "",
  y: "",
  width: "",
  length: "",
  rotation: "0",
  obstacle: true,
  north: false,
  east: false,
  south: true,
  west: false,
  defaultStorageClass: "NORMAL",
  levelCount: "2",
  levelHeight: String(LIMITS.defaultLevelHeight),
  generateBins: true,
  rowCount: "1",
  columnCount: "2",
  namingScheme: "SEQUENTIAL",
  binType: "STANDARD",
  capacityUnits: "",
  maxWeight: "",
  pickable: true,
  putawayTarget: true,
};

/* ── Khu vực ───────────────────────────────────────────────────────────── */

export function areaCreateSchema(layout: WarehouseLayout) {
  const codes = new Set(layout.areas.map((area) => area.code.toUpperCase()));
  return z
    .object({
      code: locationPart(LIMITS.codeMax, V.codeFormat).refine(
        (code) => !codes.has(code),
        V.codeTaken,
      ),
      type: z.enum(AREA_TYPES),
      name: z.string().trim().min(1, V.required).max(LIMITS.nameMax, V.tooLong(LIMITS.nameMax)),
      ...placement,
      storageClass: z.enum(STORAGE_CLASSES),
      ...locationFields,
    })
    .superRefine((value, ctx) => checkPlacement(layout, value, ctx));
}

export type AreaCreateInput = z.input<ReturnType<typeof areaCreateSchema>>;
export type AreaCreateValues = z.output<ReturnType<typeof areaCreateSchema>>;

export const EMPTY_AREA_FORM: AreaCreateInput = {
  code: "",
  type: "RECEIVING",
  name: "",
  x: "",
  y: "",
  width: "",
  length: "",
  rotation: "0",
  obstacle: false,
  storageClass: "NORMAL",
  capacityUnits: "",
  maxWeight: "",
  pickable: false,
  putawayTarget: false,
};

/** BR-11 (docs 06 §6): khu `NON_STORAGE` không phải vị trí tồn kho → không gửi `location`. */
export const isStorageArea = (type: (typeof AREA_TYPES)[number]): boolean =>
  type !== AREA_TYPE.NON_STORAGE;
