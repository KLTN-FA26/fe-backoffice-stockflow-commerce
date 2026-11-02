/**
 * Hoàn tác / làm lại cho bản nháp chế độ sửa (Ctrl+Z / Ctrl+Shift+Z) — bọc `draftReducer`, thuần.
 * Thao tác liền nhau cùng `tag` (gõ trong modal thông số, dời bằng phím mũi tên) gộp thành một bước để
 * Ctrl+Z không phải bấm từng ký tự. Lưu thành công một phần (`synced`) xoá lịch sử: bước đã gửi BE
 * không hoàn tác được ở client.
 */

import { WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { draftFromLayout } from "./draft";
import { draftReducer } from "./draft-edit";

import type { MapDraft } from "./draft";
import type { DraftAction } from "./draft-edit";
import type { WarehouseLayout } from "./types";

export interface DraftHistory {
  present: MapDraft;
  past: MapDraft[];
  future: MapDraft[];
  /** Tag của bước gần nhất — bước kế cùng tag thì gộp vào. */
  lastTag: string | null;
}

export type HistoryAction = (DraftAction & { tag?: string }) | { type: "undo" } | { type: "redo" };

export const historyFromLayout = (layout: WarehouseLayout): DraftHistory => ({
  present: draftFromLayout(layout),
  past: [],
  future: [],
  lastTag: null,
});

export function historyReducer(state: DraftHistory, action: HistoryAction): DraftHistory {
  if (action.type === "undo") {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return {
      present: previous,
      past: state.past.slice(0, -1),
      future: [state.present, ...state.future],
      lastTag: null,
    };
  }
  if (action.type === "redo") {
    const [next, ...future] = state.future;
    if (!next) return state;
    return { present: next, past: [...state.past, state.present], future, lastTag: null };
  }
  const present = draftReducer(state.present, action);
  if (present === state.present) return state;
  if (action.type === "synced" || action.type === "reset")
    return { present, past: [], future: [], lastTag: null };
  const tag = action.tag ?? null;
  // Cùng tag với bước trước → thay bước đó, không đẩy thêm vào lịch sử
  const merge = tag !== null && tag === state.lastTag;
  const past = merge ? state.past : [...state.past, state.present].slice(-LIMITS.historyLimit);
  return { present, past, future: [], lastTag: tag };
}
