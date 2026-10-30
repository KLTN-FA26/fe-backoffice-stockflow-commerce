/**
 * Nhân bản hình đang chọn (Ctrl+D) — bản sao là hình MỚI chưa lưu: mã kế tiếp chưa dùng (BR-13 không
 * cấp lại mã), đặt ngay bên dưới hình gốc cách một bước lưới (không chồng lấn chính nó — BR-07; bấm
 * liên tiếp ra một dãy kệ), kệ sao chép thông số tầng / bin để tạo cùng. Thuần.
 */

import { UI_LABELS, WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { DEFAULT_SHELF_BUILD, nextCode, usedCodes } from "./draft";
import { toMm } from "./draft-geometry";
import { boxOf } from "./selectors";

import type { DraftItem, MapDraft } from "./draft";

const D = UI_LABELS.warehouseMap.edit.defaults;
const STEP = LIMITS.snapStep;

export function duplicatedItem(draft: MapDraft, source: DraftItem, key: string): DraftItem {
  const meta = { key, id: null, version: 0 };
  if (source.kind === "boundary")
    return {
      ...source,
      ...meta,
      // Tường / cửa không kiểm chồng lấn (BR-07) — chỉ lệch một bước lưới để thấy bản sao
      startX: toMm(source.startX + STEP),
      startY: toMm(source.startY + STEP),
      endX: toMm(source.endX + STEP),
      endY: toMm(source.endY + STEP),
    };
  const footprint = {
    ...source.footprint,
    y: toMm(source.footprint.y + boxOf(source.footprint).h + STEP),
  };
  if (source.kind === "area") {
    const code = nextCode(D.areaCodeBase, usedCodes(draft, "area"));
    return { ...source, ...meta, code, name: D.areaName(code), footprint, wasStorage: false };
  }
  const code = nextCode(D.shelfCodeBase, usedCodes(draft, "shelf"));
  const { copyBuild, ...shelf } = source;
  return {
    ...shelf,
    ...meta,
    code,
    name: D.shelfName(code),
    footprint,
    // Kệ đã lưu không còn `build` → dựng lại theo tầng / bin thật của kệ gốc (`copyBuild`)
    build: { ...(source.build ?? copyBuild ?? DEFAULT_SHELF_BUILD) },
    binExtent: null,
    hasPickableBins: false,
  };
}
