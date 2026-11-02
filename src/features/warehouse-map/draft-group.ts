/**
 * Thao tác trên NHIỀU hình cùng lúc của bản nháp (chọn vùng): tìm hình trong vùng kéo, sao chép / dán
 * cả nhóm giữ nguyên bố cục tương đối, xoá cả nhóm thành một bước hoàn tác. Thuần.
 */

import { WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { newKeyOf } from "./draft";
import { duplicatedItem } from "./draft-duplicate";
import { toMm } from "./draft-geometry";
import { boxOf } from "./selectors";

import type { DraftItem, MapDraft } from "./draft";
import type { MapBox } from "./selectors";

/** Hộp bao của một hình — tường / cửa là hộp bao của đoạn thẳng (có thể dẹt 0). */
export function itemBox(item: DraftItem): MapBox {
  if (item.kind !== "boundary") return boxOf(item.footprint);
  const [x, y] = [Math.min(item.startX, item.endX), Math.min(item.startY, item.endY)];
  return { x, y, w: Math.abs(item.endX - item.startX), h: Math.abs(item.endY - item.startY) };
}

/** Chạm cạnh cũng tính — để vùng kéo bắt được cả tường dẹt (khác BR-07 chặn chồng lấn). */
const touches = (a: MapBox, b: MapBox) =>
  a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;

/** Khoá các hình chạm vùng kéo (kiểu Figma: chạm là chọn), theo thứ tự trong bản nháp. */
export function keysInBox(draft: MapDraft, area: MapBox): string[] {
  return draft.items.filter((item) => touches(itemBox(item), area)).map((item) => item.key);
}

function unionBox(boxes: readonly MapBox[]): MapBox | null {
  if (boxes.length === 0) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: right - x, h: bottom - y };
}

/** Dời một hình theo trục y (m), giữ nguyên x. */
function shiftedY(item: DraftItem, dy: number): DraftItem {
  if (item.kind === "boundary")
    return { ...item, startY: toMm(item.startY + dy), endY: toMm(item.endY + dy) };
  return { ...item, footprint: { ...item.footprint, y: toMm(item.footprint.y + dy) } };
}

/**
 * Bản sao cả nhóm: đặt ngay dưới hộp bao của nhóm cách một bước lưới (không chồng lên nhóm gốc — BR-07),
 * giữ nguyên khoảng cách giữa các hình; mỗi bản sao là hình MỚI với mã kế tiếp chưa dùng (BR-13) và kệ
 * dựng lại tầng / bin như kệ gốc. Khoá `new-<seq>` cấp liên tiếp từ `draft.seq`.
 */
export function duplicatedGroup(draft: MapDraft, sources: readonly DraftItem[]): DraftItem[] {
  const group = unionBox(sources.map(itemBox));
  if (!group) return [];
  const dy = group.h + LIMITS.snapStep;
  const copies: DraftItem[] = [];
  let working = draft;
  for (const source of sources) {
    // Cấp mã trên bản nháp đã có các bản sao trước đó → mã trong nhóm không trùng nhau
    const copy = duplicatedItem(working, source, newKeyOf(working));
    const placed = shiftedY(atSourcePosition(copy, source), dy);
    copies.push(placed);
    working = { ...working, items: [...working.items, placed], seq: working.seq + 1 };
  }
  return copies;
}

/** Đưa bản sao về đúng chỗ hình gốc (bản sao đơn lẻ tự dời dưới chính nó — nhóm dời theo hộp bao chung). */
function atSourcePosition(copy: DraftItem, source: DraftItem): DraftItem {
  if (copy.kind === "boundary" && source.kind === "boundary")
    return {
      ...copy,
      startX: source.startX,
      startY: source.startY,
      endX: source.endX,
      endY: source.endY,
    };
  if (copy.kind !== "boundary" && source.kind !== "boundary")
    return { ...copy, footprint: { ...source.footprint } };
  return copy;
}

/** Thêm các bản sao vào bản nháp (một bước hoàn tác). */
export function withPasted(draft: MapDraft, sources: readonly DraftItem[]): MapDraft {
  const copies = duplicatedGroup(draft, sources);
  return { ...draft, items: [...draft.items, ...copies], seq: draft.seq + copies.length };
}

/** Xoá nhiều hình (một bước hoàn tác): hình đã lưu vào `removed` để lưu thành Inactive / DELETE (BR-04). */
export function withoutKeys(draft: MapDraft, keys: readonly string[]): MapDraft {
  const gone = draft.items.filter((item) => keys.includes(item.key));
  if (gone.length === 0) return draft;
  return {
    ...draft,
    items: draft.items.filter((item) => !keys.includes(item.key)),
    removed: [...draft.removed, ...gone.filter((item) => item.id !== null)],
  };
}
