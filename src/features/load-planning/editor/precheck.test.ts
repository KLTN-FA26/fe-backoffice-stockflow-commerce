import { describe, expect, it } from "vitest";

import {
  editorState,
  KIT_PART_1,
  KIT_PART_2,
  layoutOne,
  layoutTwo,
  vehicleOf,
} from "../__fixtures__/editor";
import { gridBlock } from "../__fixtures__/build";

import { toTrayParcel } from "./parcels";
import { isVehicleKey, issuesByKey, precheck, vehicleKey } from "./precheck";

import type { LayoutBox } from "../types";
import type { EditorState } from "./types";

const rulesOf = (state: EditorState) => Object.fromEntries(issuesByKey(precheck(state)));
const withBoxes = (boxes: LayoutBox[], extra: Partial<ReturnType<typeof vehicleOf>> = {}) =>
  editorState({ vehicles: [{ ...vehicleOf(layoutOne), boxes, ...extra }, vehicleOf(layoutTwo)] });

describe("precheck", () => {
  it("finds nothing wrong in a valid plan", () => {
    expect(precheck(editorState())).toEqual([]);
  });

  it("flags overlap, out of bounds and unsupported on the offending boxes", () => {
    const [a, b] = layoutOne.boxes;
    const state = withBoxes([
      a,
      { ...b, xMm: 400 }, // overlaps a
      { ...a, ref: "OUT", xMm: 800, zMm: 800 }, // 800 + 500 > 1000
      { ...a, ref: "AIR", yMm: 700, xMm: 0, zMm: 800 }, // floating
    ]);
    expect(rulesOf(state)).toMatchObject({
      "BOX-001": ["OVERLAP"],
      "BOX-002": ["OVERLAP"],
      OUT: ["OUT_OF_BOUNDS"],
      AIR: ["UNSUPPORTED"],
    });
  });

  it("requires 98% support: 97% is flagged, 98% is not (BR-10)", () => {
    // a 500x400 base on top of a 100x... build support as a thin slab covering 97% / 98% of the base width
    const base = (widthMm: number): LayoutBox => ({
      ...layoutOne.boxes[0],
      ref: "BASE",
      xMm: 0,
      wMm: widthMm,
      hMm: 300,
    });
    const top: LayoutBox = { ...layoutOne.boxes[0], ref: "TOP", xMm: 0, yMm: 300, wMm: 500 };
    expect(rulesOf(withBoxes([base(485), top])).TOP).toEqual(["UNSUPPORTED"]); // 97%
    expect(rulesOf(withBoxes([base(490), top])).TOP).toBeUndefined(); // 98%
  });

  it("flags a gusset overlap with its own rule, not OVERLAP", () => {
    const gusset = { xMm: 0, yMm: 700, zMm: 0, wMm: 150, hMm: 300, dMm: 150 };
    const tall = {
      ...layoutOne.boxes[0],
      ref: "TALL",
      hMm: 1000,
      origMm: { l: 400, w: 500, h: 1000 },
    };
    expect(rulesOf(withBoxes([tall], { gussets: [gusset] })).TALL).toEqual(["GUSSET"]);
  });

  it("flags a vehicle over its payload on the vehicle key", () => {
    const heavy = layoutOne.boxes.map((box) => ({ ...box, weightKg: 60 }));
    const found = rulesOf(withBoxes(heavy));
    expect(found[vehicleKey(1)]).toEqual(["OVERWEIGHT"]);
    expect(isVehicleKey(vehicleKey(1))).toBe(true);
  });

  it("flags a rotation the parcel may not take and an orientation that does not match its sizes", () => {
    const flat = layoutTwo.boxes[0];
    const state = editorState({
      vehicles: [
        vehicleOf(layoutOne),
        { ...vehicleOf(layoutTwo), boxes: [{ ...flat, orientation: "WLH" as const }] },
      ],
    });
    expect(rulesOf(state)["FLAT-001"]).toEqual(["ORIENTATION_MISMATCH", "ROTATION_NOT_ALLOWED"]);
  });

  it("flags a box wider than the door (DOOR) only when the door is known", () => {
    const door = { widthMm: 400, heightMm: 250 };
    expect(rulesOf(withBoxes([...layoutOne.boxes], { door }))["BOX-001"]).toEqual(["DOOR"]);
    expect(rulesOf(withBoxes([...layoutOne.boxes], { door: null }))["BOX-001"]).toBeUndefined();
    expect(
      rulesOf(withBoxes([...layoutOne.boxes], { door: { widthMm: null, heightMm: null } }))[
        "BOX-001"
      ],
    ).toBeUndefined();
  });

  it("flags every part of a kit that is split across vehicles or between a vehicle and the tray (LP-3)", () => {
    const [p1] = gridBlock({
      carton: KIT_PART_1,
      origin: { xMm: 0, yMm: 0, zMm: 0 },
      counts: { nx: 1, ny: 1, nz: 1 },
    });
    const [p2] = gridBlock({
      carton: KIT_PART_2,
      origin: { xMm: 0, yMm: 0, zMm: 0 },
      counts: { nx: 1, ny: 1, nz: 1 },
    });
    const apart = editorState({
      vehicles: [
        { ...vehicleOf(layoutOne), boxes: [p1] },
        { ...vehicleOf(layoutTwo), boxes: [p2] },
      ],
      tray: [],
    });
    expect(rulesOf(apart)).toMatchObject({ "KIT1-001": ["KIT_SPLIT"], "KIT2-001": ["KIT_SPLIT"] });
    const parcel = toTrayParcel(p2);
    const trayed = editorState({
      vehicles: [{ ...vehicleOf(layoutOne), boxes: [p1] }, vehicleOf(layoutTwo)],
      tray: [parcel],
    });
    expect(rulesOf(trayed)).toMatchObject({ "KIT1-001": ["KIT_SPLIT"], "KIT2-001": ["KIT_SPLIT"] });
    const together = editorState({
      vehicles: [
        { ...vehicleOf(layoutOne), boxes: [p1, { ...p2, xMm: 400 }] },
        vehicleOf(layoutTwo),
      ],
      tray: [],
    });
    expect(precheck(together)).toEqual([]);
    const bothOnTray = editorState({
      vehicles: [vehicleOf(layoutTwo)],
      tray: [parcel, { ...parcel, ref: "KIT1-001" }],
    });
    expect(precheck(bothOnTray)).toEqual([]);
  });

  it("reuses a vehicle's findings while its box array is unchanged, so editing one vehicle rechecks only that one", () => {
    const [a, b] = layoutOne.boxes;
    const broken = withBoxes([a, { ...b, xMm: 400 }]);
    const [first] = precheck(broken);
    // another vehicle's edit produces a new state but keeps this vehicle's array → same finding objects
    const sibling = {
      ...broken,
      vehicles: [broken.vehicles[0], { ...broken.vehicles[1], boxes: [] }],
    };
    expect(precheck(sibling)[0]).toBe(first);
    // this vehicle's array changed → recomputed
    expect(precheck(withBoxes([a, { ...b, xMm: 500 }]))).toEqual([]);
  });
});
