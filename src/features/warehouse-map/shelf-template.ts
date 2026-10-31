/**
 * Thông số dựng lại một kệ ĐÃ LƯU (số tầng, cao tầng, lưới bin, kiểu đặt mã, loại / sức chứa bin, cờ
 * lấy hàng / cất hàng) suy ra từ chính tầng / bin BE trả về — để sao chép (Ctrl+D, Ctrl+C / V) ra bản
 * sao giống kệ gốc thay vì thông số mặc định. Thuần.
 */

import { planLevel } from "./selectors";

import type { ShelfBuild } from "./draft-types";
import type { LayoutShelf } from "./types";

/** Mã bin kiểu `ROW_LETTER_COLUMN` (BR-14): chữ hàng + số cột, vd `A01`; `SEQUENTIAL` chỉ có số. */
const ROW_LETTER_CODE = /^[A-Z]\d+$/;

const distinct = (values: readonly number[]) =>
  new Set(values.map((value) => Math.round(value * 1000))).size;

export function shelfTemplate(shelf: LayoutShelf, fallback: ShelfBuild): ShelfBuild {
  const levels = [...shelf.levels].sort((a, b) => a.levelIndex - b.levelIndex);
  const [first, second] = levels;
  const bins = planLevel(shelf)?.bins ?? [];
  const [bin] = bins;
  // Tầng tạo từ bản nháp: cao độ = (chỉ số − 1) × cao tầng, chiều cao dùng được = cao tầng
  const spacing =
    first?.elevation != null && second?.elevation != null
      ? second.elevation - first.elevation
      : null;
  return {
    levelCount: levels.length > 0 ? levels.length : fallback.levelCount,
    levelHeight: first?.usableHeight ?? spacing ?? fallback.levelHeight,
    generateBins: bins.length > 0,
    rowCount: bins.length > 0 ? distinct(bins.map((b) => b.footprint.y)) : fallback.rowCount,
    columnCount: bins.length > 0 ? distinct(bins.map((b) => b.footprint.x)) : fallback.columnCount,
    namingScheme: bin && ROW_LETTER_CODE.test(bin.code) ? "ROW_LETTER_COLUMN" : "SEQUENTIAL",
    binType: bin?.type ?? fallback.binType,
    capacityUnits: bin ? (bin.capacityUnits ?? null) : fallback.capacityUnits,
    maxWeight: bin ? (bin.maxWeight ?? null) : fallback.maxWeight,
    pickable: bin?.pickable ?? fallback.pickable,
    putawayTarget: bin?.putawayTarget ?? fallback.putawayTarget,
  };
}
