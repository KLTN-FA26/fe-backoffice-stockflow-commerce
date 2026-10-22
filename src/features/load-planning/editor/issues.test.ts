import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/error";

import { editorState, layoutOne } from "../__fixtures__/editor";

import { applyEdit } from "./apply";
import {
  activeServerIssues,
  isPlacementViolation,
  mergeIssues,
  serverIssuesOf,
  signatureOf,
} from "./issues";
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

  it("stops showing a violation once that box is changed, but keeps it while the box is untouched", () => {
    const sent = editorState();
    const issues = serverIssuesOf(
      violation([
        { field: "BOX-001", code: "UNSUPPORTED" },
        { field: "BOX-002", code: "OVERLAP" },
      ]),
      sent,
    );
    const moved = applyEdit(sent, { kind: "nudge", seq: 1, refs: ["BOX-002"], axis: "z", dir: 1 });
    if (!moved.ok) throw new Error("nudge rejected");
    expect(activeServerIssues(issues, sent)).toHaveLength(2);
    expect(activeServerIssues(issues, moved.state).map((i) => i.key)).toEqual(["BOX-001"]);
  });

  it("a vehicle-level violation expires when the vehicle's boxes change", () => {
    const sent = editorState();
    const issues = serverIssuesOf(violation([{ field: "vehicle:1", code: "OVERWEIGHT" }]), sent);
    const trayed = applyEdit(sent, { kind: "toTray", seq: 1, refs: ["BOX-001"] });
    if (!trayed.ok) throw new Error("toTray rejected");
    expect(activeServerIssues(issues, sent)).toHaveLength(1);
    expect(activeServerIssues(issues, trayed.state)).toEqual([]);
  });

  it("gives a ref on the tray the signature 'tray' and drops refs that vanished", () => {
    const state = editorState();
    expect(signatureOf(state, "TRAY-1")).toBe("tray");
    expect(signatureOf(state, "missing")).toBeNull();
    expect(signatureOf(state, "vehicle:9")).toBeNull();
    expect(signatureOf(state, "BOX-001")).toBe(`1|${layoutOne.boxes[0].xMm}|0|0|500|300|400`);
  });

  it("merges local and server findings without repeating the same key and rule", () => {
    const merged = mergeIssues(
      [{ key: "BOX-001", rule: "OVERLAP" }],
      [
        { key: "BOX-001", rule: "OVERLAP", signature: "s" },
        { key: "BOX-001", rule: "UNSUPPORTED", signature: "s" },
      ],
    );
    expect(merged).toEqual([
      { key: "BOX-001", rule: "OVERLAP" },
      { key: "BOX-001", rule: "UNSUPPORTED" },
    ]);
  });
});
