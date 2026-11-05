import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/error";

import { editorState } from "../__fixtures__/editor";

import { applyEdit } from "./apply";
import { historyReducer, initHistory } from "./history";
import { activeServerIssues, isPlacementViolation, mergeIssues, serverIssuesOf } from "./issues";
import { vehicleKey } from "./precheck";

const violation = (entries: { field: string; code?: string; message?: string }[]) =>
  new ApiError(
    422,
    "PLACEMENT_RULE_VIOLATION",
    "1 placement(s) break a loading rule; nothing was changed",
    undefined,
    undefined,
    undefined,
    entries.map((entry) => ({ message: "x", ...entry })),
  );

describe("server placement violations", () => {
  it("recognises the 422 envelope and reads every {field, code} pair, including several rules on one box", () => {
    const state = editorState();
    const error = violation([
      { field: "BOX-001", code: "UNSUPPORTED" },
      { field: "BOX-001", code: "OVERLAP" },
      { field: vehicleKey(1), code: "OVERWEIGHT" },
      { field: "TRAY-1", code: "KIT_SPLIT" },
    ]);
    expect(isPlacementViolation(error)).toBe(true);
    expect(serverIssuesOf(error, state).map(({ key, rule }) => ({ key, rule }))).toEqual([
      { key: "BOX-001", rule: "UNSUPPORTED" },
      { key: "BOX-001", rule: "OVERLAP" },
      { key: "vehicle:1", rule: "OVERWEIGHT" },
      { key: "TRAY-1", rule: "KIT_SPLIT" },
    ]);
  });

  it("ignores other errors, unknown rule codes and refs that are not in the plan", () => {
    const state = editorState();
    expect(serverIssuesOf(new ApiError(409, "OPTIMISTIC_LOCK", "x"), state)).toEqual([]);
    expect(serverIssuesOf(new Error("boom"), state)).toEqual([]);
    const error = violation([
      { field: "BOX-001", code: "SOMETHING_NEW" },
      { field: "ghost", code: "OVERLAP" },
      { field: "BOX-002" },
    ]);
    expect(serverIssuesOf(error, state)).toEqual([]);
  });

  it("any layout change clears the server violations, not only a change to the flagged box (multi-box rules)", () => {
    const sent = editorState();
    const issues = serverIssuesOf(
      violation([
        { field: "BOX-001", code: "UNSUPPORTED" },
        { field: "BOX-002", code: "OVERLAP" },
      ]),
      sent,
    );
    expect(activeServerIssues(issues, sent)).toHaveLength(2);
    // moving the OTHER box (BOX-002) also fixes what was reported on BOX-001
    const moved = applyEdit(sent, { kind: "nudge", seq: 1, refs: ["BOX-002"], axis: "z", dir: 1 });
    if (!moved.ok) throw new Error("nudge rejected");
    expect(activeServerIssues(issues, moved.state)).toEqual([]);
    // an unrelated edit in another vehicle clears them too
    const other = applyEdit(sent, { kind: "toTray", seq: 2, refs: ["FLAT-001"] });
    if (!other.ok) throw new Error("toTray rejected");
    expect(activeServerIssues(issues, other.state)).toEqual([]);
  });

  it("undoing the edit that caused a KIT_SPLIT clears the server's KIT_SPLIT violation (and redo does not resurrect it)", () => {
    const base = editorState();
    let h = initHistory(base);
    h = historyReducer(h, { type: "edit", command: { kind: "toTray", seq: 1, refs: ["BOX-001"] } });
    const sent = h.present;
    const issues = serverIssuesOf(
      violation([
        { field: "BOX-001", code: "KIT_SPLIT" },
        { field: "BOX-002", code: "KIT_SPLIT" },
      ]),
      sent,
    );
    expect(activeServerIssues(issues, h.present)).toHaveLength(2);
    h = historyReducer(h, { type: "undo" });
    expect(activeServerIssues(issues, h.present)).toEqual([]);
    // redo returns to the exact state that was sent: the same layout, so the same verdict applies again
    h = historyReducer(h, { type: "redo" });
    expect(activeServerIssues(issues, h.present)).toHaveLength(2);
  });

  it("a vehicle-level violation expires when the vehicle's boxes change", () => {
    const sent = editorState();
    const issues = serverIssuesOf(violation([{ field: "vehicle:1", code: "OVERWEIGHT" }]), sent);
    const trayed = applyEdit(sent, { kind: "toTray", seq: 1, refs: ["BOX-001"] });
    if (!trayed.ok) throw new Error("toTray rejected");
    expect(activeServerIssues(issues, sent)).toHaveLength(1);
    expect(activeServerIssues(issues, trayed.state)).toEqual([]);
  });

  it("merges local and server findings without repeating the same key and rule", () => {
    const merged = mergeIssues(
      [{ key: "BOX-001", rule: "OVERLAP" }],
      [
        { key: "BOX-001", rule: "OVERLAP", sent: editorState() },
        { key: "BOX-001", rule: "UNSUPPORTED", sent: editorState() },
      ],
    );
    expect(merged).toEqual([
      { key: "BOX-001", rule: "OVERLAP" },
      { key: "BOX-001", rule: "UNSUPPORTED" },
    ]);
  });
});
