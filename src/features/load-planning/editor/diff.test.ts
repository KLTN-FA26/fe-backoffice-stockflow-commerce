import { describe, expect, it } from "vitest";

import { editorState, layoutOne, vehicleOf } from "../__fixtures__/editor";

import { applyEdit } from "./apply";
import { diffEditorStates } from "./diff";

describe("diffEditorStates", () => {
  it("reports nothing for identical states and allows overwriting", () => {
    const state = editorState();
    expect(diffEditorStates(state, editorState())).toMatchObject({
      moved: [],
      added: [],
      removed: [],
      sameVehicles: true,
      canOverwrite: true,
    });
  });

  it("lists parcels someone else moved to another vehicle, the tray or another spot", () => {
    const base = editorState();
    const away = applyEdit(base, { kind: "toTray", seq: 1, refs: ["BOX-001"] });
    const nudged = applyEdit(base, { kind: "nudge", seq: 1, refs: ["BOX-002"], axis: "z", dir: 1 });
    if (!away.ok || !nudged.ok) throw new Error("rejected");
    expect(diffEditorStates(base, away.state).moved).toEqual([
      { ref: "BOX-001", label: "PKG-BOX", from: 1, to: null },
    ]);
    expect(diffEditorStates(base, nudged.state).moved).toEqual([
      { ref: "BOX-002", label: "PKG-BOX", from: 1, to: 1 },
    ]);
  });

  it("cannot overwrite when parcels were added or removed on the server (BE wants every parcel once)", () => {
    const base = editorState();
    const fewer = editorState({ tray: [] });
    const diff = diffEditorStates(base, fewer);
    expect(diff.removed).toEqual(["TRAY-1"]);
    expect(diff.canOverwrite).toBe(false);
    const more = editorState({ tray: [...base.tray, { ...base.tray[0], ref: "NEW" }] });
    expect(diffEditorStates(base, more).added).toEqual(["NEW"]);
    expect(diffEditorStates(base, more).canOverwrite).toBe(false);
  });

  it("cannot overwrite when the vehicles themselves changed", () => {
    const base = editorState();
    const other = editorState({
      vehicles: [{ ...vehicleOf(layoutOne), code: "OTHER-TYPE" }, base.vehicles[1]],
    });
    expect(diffEditorStates(base, other)).toMatchObject({
      sameVehicles: false,
      canOverwrite: false,
    });
    const fewerVehicles = editorState({ vehicles: [base.vehicles[0]] });
    expect(diffEditorStates(base, fewerVehicles).sameVehicles).toBe(false);
  });
});
