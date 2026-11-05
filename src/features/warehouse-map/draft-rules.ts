/**
 * Luật của bản nháp bản đồ — kiểm ngay khi vẽ / kéo / chỉnh, lỗi hiện tại ô và chặn nút Lưu. Cùng luật
 * với form cũ (`input-schemas*.ts`) nhưng xét mọi hình trong bản nháp cùng lúc. FE kiểm trước —
 * Backend phải re-check (409 LAYOUT_OUT_OF_BOUNDS / LAYOUT_OVERLAP / PICK_FACE_REQUIRED / *_CODE_*).
 */

import { AREA_TYPE, UI_LABELS, WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { LOCATION_PART_PATTERN } from "./input-schemas";
import { boxesOverlap, boxOf, fitsWithin, hasAtMostDecimals } from "./selectors";

import type { DraftBoundary, DraftItem, DraftPlace, DraftShelf, MapDraft } from "./draft";

const V = UI_LABELS.warehouseMap.validation;
const VE = UI_LABELS.warehouseMap.edit.validation;

export type DraftField =
  "code" | "name" | "type" | "placement" | "pickFaces" | "build" | "zone" | "line";
export type DraftIssues = Partial<Record<DraftField, string>>;

const isPlace = (item: DraftItem): item is DraftPlace => item.kind !== "boundary";

function measureIssue(values: number[], positive: boolean): string | null {
  for (const value of values) {
    if (!Number.isFinite(value) || (positive ? value <= 0 : value < 0))
      return positive ? V.positive : V.nonNegative;
    if (value > LIMITS.measureMax) return V.positive;
    if (!hasAtMostDecimals(value, LIMITS.measureFractionDigits)) return V.fraction;
  }
  return null;
}

function codeIssue(item: DraftPlace, draft: MapDraft): string | null {
  const code = item.code.trim();
  if (!code) return V.required;
  // BR-10 (docs 06 §6): mỗi thành phần mã vị trí ≤ 20 ký tự A–Z0–9, không có "-"
  if (code.length > LIMITS.codeMax || !LOCATION_PART_PATTERN.test(code)) return V.codeFormat;
  // BR-13 (docs 06 §6): mã duy nhất trong kho, mã của vị trí INACTIVE / vừa ngừng không cấp lại
  const upper = code.toUpperCase();
  const clash = [...draft.items, ...draft.removed].some(
    (other) =>
      other.key !== item.key && other.kind === item.kind && other.code.toUpperCase() === upper,
  );
  return clash || draft.inactiveCodes[item.kind].includes(upper) ? V.codeTaken : null;
}

function placementIssue(item: DraftPlace, draft: MapDraft, frame: Frame): string | null {
  const { x, y, width, length, rotation } = item.footprint;
  const measure = measureIssue([x, y], false) ?? measureIssue([width, length], true);
  if (measure) return measure;
  // BR-09 (docs 06 §6): góc xoay chỉ 0 / 90 / 180 / 270
  if (!(LIMITS.rotations as readonly number[]).includes(rotation)) return V.positive;
  const box = boxOf(item.footprint);
  // BR-06 (docs 06 §6): nằm trong khung bản đồ, chạm mép tính là bên trong
  if (!fitsWithin(box, frame.mapWidth, frame.mapHeight)) return V.outOfBounds;
  // BR-07 (docs 06 §6): kệ không thu nhỏ quá phạm vi bin đang có
  if (item.kind === "shelf" && item.binExtent) {
    const { width: w, length: l } = item.binExtent;
    if (width + 1e-9 < w || length + 1e-9 < l) return VE.shrinkBelowBins;
  }
  // BR-07: không chồng lấn kệ / khu vực khác đang dùng (hình bị xoá sẽ thành INACTIVE → không tính)
  const hit = draft.items.find(
    (other) =>
      other.key !== item.key && isPlace(other) && boxesOverlap(box, boxOf(other.footprint)),
  );
  return hit && isPlace(hit) ? V.overlap(hit.code) : null;
}

function shelfIssues(shelf: DraftShelf, draft: MapDraft): DraftIssues {
  const issues: DraftIssues = {};
  const faces = Object.values(shelf.pickFaces).some(Boolean);
  const build = shelf.build;
  const pickableBins = shelf.hasPickableBins || Boolean(build?.generateBins && build.pickable);
  // BR-08 (docs 06 §6): kệ có bin cho lấy hàng phải có ít nhất một mặt lấy hàng
  if (pickableBins && build?.levelCount !== 0 && !faces) issues.pickFaces = V.pickFaceRequired;
  if (shelf.zoneKey && !draft.zones.some((zone) => zone.key === shelf.zoneKey))
    issues.zone = VE.zoneMissing;
  if (!build) return issues;
  const height = measureIssue([build.levelHeight], true);
  // BR-15 (docs 06 §6): tối đa 20 tầng mỗi kệ
  if (
    !Number.isInteger(build.levelCount) ||
    build.levelCount < 0 ||
    build.levelCount > LIMITS.levelsPerShelfMax
  )
    issues.build = V.levelsMax;
  else if (height) issues.build = height;
  else if (build.generateBins && build.levelCount > 0) {
    const cells = build.rowCount * build.columnCount;
    // BR-14 (docs 06 §6): hàng × cột ≤ 200 bin mỗi tầng
    if (build.rowCount < 1 || build.columnCount < 1 || cells > LIMITS.binsPerLevelMax)
      issues.build = V.binsMax;
    // BR-14: kiểu ROW_LETTER_COLUMN dùng chữ A–Z cho hàng
    else if (build.namingScheme === "ROW_LETTER_COLUMN" && build.rowCount > LIMITS.letterRowsMax)
      issues.build = V.letterRowsMax;
  }
  return issues;
}

function lineIssue(line: DraftBoundary, frame: Frame): string | null {
  const values = [line.startX, line.startY, line.endX, line.endY];
  const measure = measureIssue(values, false);
  if (measure) return measure;
  if (line.startX === line.endX && line.startY === line.endY) return V.boundaryZero;
  // BR-06 (docs 06 §6): hai đầu tường / cửa nằm trong khung bản đồ
  const inside =
    line.endX <= frame.mapWidth &&
    line.startX <= frame.mapWidth &&
    line.endY <= frame.mapHeight &&
    line.startY <= frame.mapHeight;
  return inside ? null : V.outOfBounds;
}

interface Frame {
  mapWidth: number;
  mapHeight: number;
}

/** Lỗi theo `key` của hình; hình hợp lệ không có mặt trong map. */
export function validateDraft(draft: MapDraft, frame: Frame): Map<string, DraftIssues> {
  const result = new Map<string, DraftIssues>();
  for (const item of draft.items) {
    let issues: DraftIssues;
    if (item.kind === "boundary") {
      const line = lineIssue(item, frame);
      issues = line ? { line } : {};
    } else {
      issues = item.kind === "shelf" ? shelfIssues(item, draft) : {};
      // BR-11 (docs 06 §6): khu chứa hàng không đổi được thành NON_STORAGE (chiều ngược lại được)
      if (item.kind === "area" && item.wasStorage && item.type === AREA_TYPE.NON_STORAGE)
        issues.type = VE.storageToNonStorage;
      const code = codeIssue(item, draft);
      const placement = placementIssue(item, draft, frame);
      const name = item.name.trim()
        ? item.name.length > LIMITS.nameMax
          ? V.tooLong(LIMITS.nameMax)
          : null
        : V.required;
      if (code) issues.code = code;
      if (placement) issues.placement = placement;
      if (name) issues.name = name;
    }
    if (Object.keys(issues).length > 0) result.set(item.key, issues);
  }
  return result;
}
