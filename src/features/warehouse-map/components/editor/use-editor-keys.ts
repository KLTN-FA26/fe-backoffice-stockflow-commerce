"use client";

import { WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { useHotkeys } from "../shared/use-hotkeys";

import type { DraftTool } from "@/features/warehouse-map/draft-edit";
import type { HotkeyMap } from "../shared/use-hotkeys";
import type { MapEditor } from "./use-map-editor";

const TOOLS: Record<string, DraftTool> = {
  v: "select",
  k: "shelf",
  a: "area",
  w: "wall",
  d: "door",
};
const ARROWS: Record<string, [number, number]> = {
  arrowleft: [-1, 0],
  arrowright: [1, 0],
  arrowup: [0, -1],
  arrowdown: [0, 1],
};

export interface EditorKeyActions {
  inspect: () => void;
  addZone: () => void;
  save: () => void;
  zoom: (step: 1 | -1 | 0) => void;
}

/** Không có gì đang focus → Tab dùng để chọn hình; có focus (nút, ô) → Tab chuyển focus như thường. */
const nothingFocused = (event: KeyboardEvent) =>
  event.target === document.body || event.target === document.documentElement;

/**
 * Phím tắt chế độ sửa (bảng đầy đủ: `WAREHOUSE_MAP_SHORTCUTS.edit`, hiện trong modal "?"). `enabled`
 * tắt khi có dialog mở; Ctrl+S vẫn lưu được cả khi đang gõ trong ô nhập (`canSave`).
 */
export function useEditorKeys(
  editor: MapEditor,
  actions: EditorKeyActions,
  { enabled, canSave }: { enabled: boolean; canSave: boolean },
): void {
  const map: HotkeyMap = {
    z: actions.addZone,
    enter: actions.inspect,
    r: editor.rotate,
    delete: editor.remove,
    backspace: editor.remove,
    "mod+d": editor.duplicate,
    "mod+c": editor.copy,
    "mod+v": editor.paste,
    "mod+a": () =>
      editor.selectMany(
        editor.draft.items.map((item) => item.key),
        false,
      ),
    "mod+z": editor.undo,
    "mod+shift+z": editor.redo,
    "mod+y": editor.redo,
    tab: (event) => {
      if (!nothingFocused(event)) return false;
      editor.cycle(1);
    },
    "shift+tab": (event) => {
      if (!nothingFocused(event)) return false;
      editor.cycle(-1);
    },
    "+": () => actions.zoom(1),
    "=": () => actions.zoom(1),
    "-": () => actions.zoom(-1),
    "0": () => actions.zoom(0),
    escape: () => (editor.tool === "select" ? editor.select(null) : editor.setTool("select")),
  };
  for (const [key, tool] of Object.entries(TOOLS)) map[key] = () => editor.setTool(tool);
  for (const [key, [dx, dy]] of Object.entries(ARROWS)) {
    map[key] = () => editor.nudge(dx * LIMITS.nudgeStep, dy * LIMITS.nudgeStep);
    map[`shift+${key}`] = () =>
      editor.nudge(dx * LIMITS.nudgeStepLarge, dy * LIMITS.nudgeStepLarge);
  }
  useHotkeys(map, { enabled });
  useHotkeys({ "mod+s": actions.save }, { enabled: canSave, allowWhileTyping: ["mod+s"] });
}
