import { describe, expect, it } from "vitest";

import { editorState, layoutOne, layoutTwo, TRAY_PARCEL, vehicleOf } from "../__fixtures__/editor";

import { applyEdit } from "./apply";

import type { EditResult, EditorState, Placement } from "./types";

const placementOf = (xMm: number, yMm: number, zMm: number): Placement => ({
  xMm,
  yMm,
  zMm,
  wMm: 500,
  hMm: 300,
  dMm: 400,
  orientation: "LWH",
});

function mustOk(result: EditResult): EditorState {
  if (!result.ok) throw new Error(`rejected: ${result.reason}`);
  return result.state;
}

describe("applyEdit toTray", () => {
  it("moves boxes to the tray as parcels without a spot, other vehicles keep their array", () => {
    const state = editorState();
    const next = mustOk(applyEdit(state, { kind: "toTray", seq: 1, refs: ["BOX-001"] }));
    expect(next.vehicles[0].boxes.map((b) => b.ref)).toEqual(["BOX-002"]);
    expect(next.tray.map((p) => p.ref)).toEqual(["TRAY-1", "BOX-001"]);
    expect(next.tray[1]).not.toHaveProperty("xMm");
    expect(next.tray[1]).not.toHaveProperty("orientation");
    expect(next.vehicles[1]).toBe(state.vehicles[1]);
  });

  it("rejects an unknown ref or vehicle", () => {
    expect(applyEdit(editorState(), { kind: "toTray", seq: 1, refs: ["nope"] })).toEqual({
      ok: false,
      reason: "notFound",
    });
    expect(applyEdit(editorState(), { kind: "toTray", seq: 9, refs: ["BOX-001"] })).toEqual({
      ok: false,
      reason: "notFound",
    });
  });
});

describe("applyEdit place", () => {
  it("places a tray parcel at a valid spot and removes it from the tray", () => {
    const next = mustOk(
      applyEdit(editorState(), {
        kind: "place",
        seq: 1,
        ref: "TRAY-1",
        placement: placementOf(0, 0, 400),
      }),
    );
    expect(next.tray).toEqual([]);
    expect(next.vehicles[0].boxes.at(-1)).toMatchObject({
      ref: "TRAY-1",
      xMm: 0,
      zMm: 400,
      label: "PKG-T1",
      origMm: TRAY_PARCEL.origMm,
    });
  });

  it("rejects overlapping, floating and out-of-bounds spots", () => {
    const overlapping = placementOf(0, 0, 0);
    const floating = placementOf(0, 500, 400);
    const outside = placementOf(800, 0, 400);
    for (const placement of [overlapping, floating, outside]) {
      expect(applyEdit(editorState(), { kind: "place", seq: 1, ref: "TRAY-1", placement })).toEqual(
        { ok: false, reason: "placeInvalid" },
      );
    }
  });

  it("rejects extents that do not match the parcel's orientation and rotation of a fixed parcel", () => {
    const wrongExtent = { ...placementOf(0, 0, 400), wMm: 400 };
    expect(
      applyEdit(editorState(), { kind: "place", seq: 1, ref: "TRAY-1", placement: wrongExtent }),
    ).toEqual({ ok: false, reason: "placeInvalid" });
    const fixed = { ...TRAY_PARCEL, rotatable: false };
    const rotated: Placement = {
      ...placementOf(0, 0, 400),
      wMm: 400,
      dMm: 500,
      orientation: "WLH",
    };
    expect(
      applyEdit(editorState({ tray: [fixed] }), {
        kind: "place",
        seq: 1,
        ref: "TRAY-1",
        placement: rotated,
      }),
    ).toEqual({ ok: false, reason: "placeInvalid" });
  });

  it("rejects a parcel that would push the vehicle over its payload", () => {
    const heavy = { ...TRAY_PARCEL, weightKg: 85 };
    expect(
      applyEdit(editorState({ tray: [heavy] }), {
        kind: "place",
        seq: 1,
        ref: "TRAY-1",
        placement: placementOf(0, 0, 400),
      }),
    ).toEqual({ ok: false, reason: "overweight" });
  });

  it("rejects a spot that does not pass the vehicle door", () => {
    const narrowDoor = { ...vehicleOf(layoutOne), door: { widthMm: 400, heightMm: null } };
    const state = editorState({ vehicles: [narrowDoor, vehicleOf(layoutTwo)] });
    expect(
      applyEdit(state, { kind: "place", seq: 1, ref: "TRAY-1", placement: placementOf(0, 0, 400) }),
    ).toEqual({ ok: false, reason: "placeInvalid" });
  });

  it("rejects a ref that is not on the tray", () => {
    expect(
      applyEdit(editorState(), {
        kind: "place",
        seq: 1,
        ref: "BOX-001",
        placement: placementOf(0, 0, 400),
      }),
    ).toEqual({ ok: false, reason: "notFound" });
  });
});

describe("applyEdit nudge", () => {
  it("moves a box by the step along the axis", () => {
    const next = mustOk(
      applyEdit(editorState(), { kind: "nudge", seq: 1, refs: ["BOX-002"], axis: "z", dir: 1 }),
    );
    expect(next.vehicles[0].boxes[1].zMm).toBe(50);
    expect(next.vehicles[0].boxes[0]).toBe(layoutOne.boxes[0]);
  });

  it("stops flush against an obstacle instead of stepping into it", () => {
    const state = editorState();
    // BOX-002 starts at x 500 touching BOX-001; moving left is blocked outright
    expect(
      applyEdit(state, { kind: "nudge", seq: 1, refs: ["BOX-002"], axis: "x", dir: -1 }),
    ).toEqual({
      ok: false,
      reason: "nudgeBlocked",
    });
    // BOX-001 moving right travels nothing, but BOX-002 moving right is limited by the wall (x 1000)
    expect(
      applyEdit(state, { kind: "nudge", seq: 1, refs: ["BOX-001"], axis: "x", dir: 1 }),
    ).toEqual({
      ok: false,
      reason: "nudgeBlocked",
    });
  });

  it("slides only the free distance when closer than a step", () => {
    const state = editorState();
    const nudged = mustOk(
      applyEdit(state, { kind: "nudge", seq: 1, refs: ["BOX-001", "BOX-002"], axis: "z", dir: 1 }),
    );
    const moved = mustOk(
      applyEdit(nudged, { kind: "nudge", seq: 1, refs: ["BOX-001"], axis: "z", dir: -1 }),
    );
    // BOX-001 goes back 50 mm to the wall: free distance is exactly 50
    expect(moved.vehicles[0].boxes[0].zMm).toBe(0);
    // another step toward the front wall is blocked
    expect(
      applyEdit(moved, { kind: "nudge", seq: 1, refs: ["BOX-001"], axis: "z", dir: -1 }),
    ).toEqual({
      ok: false,
      reason: "nudgeBlocked",
    });
  });

  it("travels only the free distance when an obstacle is closer than a step", () => {
    const near = { ...vehicleOf(layoutOne), boxes: [{ ...layoutOne.boxes[0], zMm: 20 }] };
    const state = editorState({ vehicles: [near, vehicleOf(layoutTwo)] });
    const next = mustOk(
      applyEdit(state, { kind: "nudge", seq: 1, refs: ["BOX-001"], axis: "z", dir: -1 }),
    );
    expect(next.vehicles[0].boxes[0].zMm).toBe(0);
  });

  it("moves a selected group as one unit, not blocked by its own members", () => {
    const next = mustOk(
      applyEdit(editorState(), {
        kind: "nudge",
        seq: 1,
        refs: ["BOX-001", "BOX-002"],
        axis: "z",
        dir: 1,
      }),
    );
    expect(next.vehicles[0].boxes.map((b) => b.zMm)).toEqual([50, 50]);
  });

  it("is blocked by a gusset block", () => {
    const gusset = { xMm: 0, yMm: 700, zMm: 0, wMm: 150, hMm: 300, dMm: 150 };
    const high = {
      ...vehicleOf(layoutOne),
      gussets: [gusset],
      boxes: [{ ...layoutOne.boxes[0], yMm: 400 }],
    };
    const state = editorState({ vehicles: [high, vehicleOf(layoutTwo)] });
    // box top is at 700 = gusset bottom: cannot go up
    expect(
      applyEdit(state, { kind: "nudge", seq: 1, refs: ["BOX-001"], axis: "y", dir: 1 }),
    ).toEqual({
      ok: false,
      reason: "nudgeBlocked",
    });
  });
});

describe("applyEdit rotate", () => {
  it("rotates to an orientation that fits, keeping the corner", () => {
    const next = mustOk(
      applyEdit(editorState(), { kind: "rotate", seq: 1, refs: ["BOX-001"], orientation: "WLH" }),
    );
    const rotated = next.vehicles[0].boxes[0];
    // BOX origMm l400 w500 h300; WLH reads (z,x,y) = (W,L,H) → x 400, y 300, z 500
    expect(rotated).toMatchObject({ wMm: 400, hMm: 300, dMm: 500, orientation: "WLH", xMm: 0 });
  });

  it("refuses to rotate a parcel without the rotatable flag (BR-10)", () => {
    expect(
      applyEdit(editorState(), { kind: "rotate", seq: 2, refs: ["FLAT-001"], orientation: "WLH" }),
    ).toEqual({ ok: false, reason: "rotateForbidden" });
  });

  it("refuses an orientation that collides with a neighbour, changing nothing", () => {
    // LHW stands the box up (500 tall) under a 350 mm ceiling
    const lowCeiling = { ...vehicleOf(layoutOne), innerMm: { l: 2000, w: 1000, h: 350 } };
    const state = editorState({ vehicles: [lowCeiling, vehicleOf(layoutTwo)] });
    expect(
      applyEdit(state, { kind: "rotate", seq: 1, refs: ["BOX-001"], orientation: "LHW" }),
    ).toEqual({ ok: false, reason: "rotateNoFit" });
  });

  it("reports an unchanged pose instead of adding an undo step", () => {
    expect(
      applyEdit(editorState(), { kind: "rotate", seq: 1, refs: ["BOX-001"], orientation: "LWH" }),
    ).toEqual({ ok: false, reason: "unchanged" });
  });
});

describe("applyEdit settle", () => {
  it("drops a floating box onto what is below it", () => {
    const floating = { ...layoutOne.boxes[0], yMm: 600, ref: "FLOAT" };
    const state = editorState({
      vehicles: [
        { ...vehicleOf(layoutOne), boxes: [...layoutOne.boxes, floating] },
        vehicleOf(layoutTwo),
      ],
    });
    const next = mustOk(applyEdit(state, { kind: "settle", seq: 1 }));
    expect(next.vehicles[0].boxes.at(-1)?.yMm).toBe(300);
  });

  it("says so when nothing floats", () => {
    expect(applyEdit(editorState(), { kind: "settle", seq: 1 })).toEqual({
      ok: false,
      reason: "nothingToSettle",
    });
  });
});
