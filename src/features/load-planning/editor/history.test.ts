import { describe, expect, it } from "vitest";

import { LOAD_PLANNING_LIMITS } from "@/constants";

import { editorState } from "../__fixtures__/editor";

import { historyReducer, initHistory, isDirty } from "./history";

import type { EditCommand } from "./types";

const toTray: EditCommand = { kind: "toTray", seq: 1, refs: ["BOX-001"] };
const nudge: EditCommand = { kind: "nudge", seq: 1, refs: ["BOX-002"], axis: "z", dir: 1 };

describe("editor history", () => {
  it("starts clean, becomes dirty on an edit and clean again after undoing it", () => {
    let h = initHistory(editorState());
    expect(isDirty(h)).toBe(false);
    h = historyReducer(h, { type: "edit", command: toTray });
    expect(isDirty(h)).toBe(true);
    expect(h.present.tray).toHaveLength(2);
    h = historyReducer(h, { type: "undo" });
    expect(isDirty(h)).toBe(false);
    expect(h.present).toBe(h.baseline);
  });

  it("redo reapplies an undone step and a new edit clears the redo branch", () => {
    let h = initHistory(editorState());
    h = historyReducer(h, { type: "edit", command: toTray });
    const afterTray = h.present;
    h = historyReducer(h, { type: "undo" });
    h = historyReducer(h, { type: "redo" });
    expect(h.present).toBe(afterTray);
    h = historyReducer(h, { type: "undo" });
    h = historyReducer(h, { type: "edit", command: nudge });
    expect(h.future).toEqual([]);
    const same = historyReducer(h, { type: "redo" });
    expect(same).toBe(h);
  });

  it("undo and redo with nothing to do return the same history object", () => {
    const h = initHistory(editorState());
    expect(historyReducer(h, { type: "undo" })).toBe(h);
    expect(historyReducer(h, { type: "redo" })).toBe(h);
  });

  it("a rejected edit changes nothing but leaves a notice that re-fires for the same reason", () => {
    let h = initHistory(editorState());
    const blocked: EditCommand = { kind: "nudge", seq: 1, refs: ["BOX-002"], axis: "x", dir: -1 };
    h = historyReducer(h, { type: "edit", command: blocked });
    expect(h.present).toBe(h.baseline);
    expect(h.past).toEqual([]);
    expect(h.notice).toEqual({ reason: "nudgeBlocked", id: 1 });
    h = historyReducer(h, { type: "edit", command: blocked });
    expect(h.notice).toEqual({ reason: "nudgeBlocked", id: 2 });
    h = historyReducer(h, { type: "edit", command: nudge });
    expect(h.notice).toBeNull();
  });

  it("keeps at most editorHistoryMax steps and stays dirty after undoing all of them", () => {
    let h = initHistory(editorState());
    const total = LOAD_PLANNING_LIMITS.editorHistoryMax + 10;
    for (let i = 0; i < total; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      h = historyReducer(h, {
        type: "edit",
        command: { kind: "nudge", seq: 1, refs: ["BOX-002"], axis: "z", dir },
      });
    }
    expect(h.past).toHaveLength(LOAD_PLANNING_LIMITS.editorHistoryMax);
    for (let i = 0; i < LOAD_PLANNING_LIMITS.editorHistoryMax; i++)
      h = historyReducer(h, { type: "undo" });
    expect(h.past).toEqual([]);
    expect(isDirty(h)).toBe(true);
  });

  it("reset starts over from a new state", () => {
    let h = initHistory(editorState());
    h = historyReducer(h, { type: "edit", command: toTray });
    const fresh = editorState({ tray: [] });
    h = historyReducer(h, { type: "reset", state: fresh });
    expect(h.present).toBe(fresh);
    expect(isDirty(h)).toBe(false);
    expect(h.past).toEqual([]);
  });
});
