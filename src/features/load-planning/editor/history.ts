/**
 * Hoàn tác / làm lại. Mỗi thao tác thành công là một bước; thao tác bị từ chối không đổi trạng thái mà để lại `notice`
 * (kèm số thứ tự để cùng một lý do lặp lại vẫn báo lại được).
 */

import { LOAD_PLANNING_LIMITS } from "@/constants";

import { applyEdit } from "./apply";

import type { EditCommand, EditorState, RejectReason } from "./types";

export interface EditorHistory {
  /** Trạng thái lúc mở trình soạn; còn khác nó nghĩa là có thay đổi chưa lưu (kể cả khi bước cũ đã bị cắt khỏi `past`). */
  baseline: EditorState;
  past: readonly EditorState[];
  present: EditorState;
  future: readonly EditorState[];
  notice: { reason: RejectReason; id: number } | null;
}

export type HistoryAction =
  | { type: "edit"; command: EditCommand }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; state: EditorState };

export const initHistory = (state: EditorState): EditorHistory => ({
  baseline: state,
  past: [],
  present: state,
  future: [],
  notice: null,
});

export const isDirty = (history: EditorHistory): boolean => history.present !== history.baseline;

export function historyReducer(history: EditorHistory, action: HistoryAction): EditorHistory {
  switch (action.type) {
    case "reset":
      return initHistory(action.state);
    case "undo": {
      const previous = history.past.at(-1);
      if (!previous) return history;
      return {
        ...history,
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
        notice: null,
      };
    }
    case "redo": {
      const [next, ...rest] = history.future;
      if (!next) return history;
      return {
        ...history,
        past: [...history.past, history.present],
        present: next,
        future: rest,
        notice: null,
      };
    }
    case "edit": {
      const result = applyEdit(history.present, action.command);
      if (!result.ok)
        return { ...history, notice: { reason: result.reason, id: (history.notice?.id ?? 0) + 1 } };
      return {
        ...history,
        past: [...history.past, history.present].slice(-LOAD_PLANNING_LIMITS.editorHistoryMax),
        present: result.state,
        future: [],
        notice: null,
      };
    }
  }
}
