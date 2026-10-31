/**
 * Ghi kết quả một lần lưu vào bản nháp: hình / zone nhận `id` + `version` của BE và thành "đã lưu"
 * (ảnh chụp `base` mới). Kệ dựng tầng / bin dở dang giữ lại phần còn thiếu để lần lưu sau dựng tiếp.
 * Thuần.
 */

import { snapshot } from "./draft";

import type { DraftItem, DraftZone, MapDraft } from "./draft";

/** Kết quả một request lưu: hình / zone theo `key` nay có `id` + `version` của BE. */
export interface SavedRef {
  key: string;
  id: string;
  version: number;
  /** Kệ dựng tầng / bin hỏng giữa chừng: các tầng ĐÃ tạo — lần lưu sau dựng tiếp từ đây. */
  pendingLevelIds?: string[];
}

/**
 * Kệ vừa dựng xong: bin sinh theo cạnh kệ → phạm vi bin = cạnh kệ; bỏ `build` (chỉ dùng lúc tạo).
 * Dựng dở: giữ `build` + tầng đã tạo để `draft-plan` lên lịch dựng tiếp (không mất phần còn thiếu).
 */
function afterBuild(item: DraftItem, ref: SavedRef): DraftItem {
  if (item.kind !== "shelf" || !item.build) return item;
  if (ref.pendingLevelIds) return { ...item, builtLevelIds: ref.pendingLevelIds };
  const withBins = item.build.generateBins && item.build.levelCount > 0;
  const { builtLevelIds: _done, ...shelf } = item;
  return {
    ...shelf,
    build: null,
    binExtent: withBins ? { width: item.footprint.width, length: item.footprint.length } : null,
    hasPickableBins: withBins && item.build.pickable,
  };
}

export function synced(draft: MapDraft, saved: SavedRef[], removedKeys: string[]): MapDraft {
  // Không request nào thành công → bản nháp giữ nguyên (lịch sử hoàn tác không bị xoá oan)
  if (saved.length === 0 && removedKeys.length === 0) return draft;
  const refs = new Map(saved.map((ref) => [ref.key, ref]));
  const base = { ...draft.base };
  const apply = <T extends DraftItem | DraftZone>(value: T, ref: SavedRef): T => {
    const next = { ...value, id: ref.id, version: ref.version };
    base[ref.key] = snapshot(next);
    return next;
  };
  return {
    ...draft,
    zones: draft.zones.map((z) => {
      const ref = refs.get(z.key);
      return ref ? apply(z, ref) : z;
    }),
    items: draft.items.map((item) => {
      const ref = refs.get(item.key);
      return ref ? apply(afterBuild(item, ref), ref) : item;
    }),
    removed: draft.removed.filter((item) => !removedKeys.includes(item.key)),
    base,
  };
}
