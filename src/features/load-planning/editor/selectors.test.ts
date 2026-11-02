import { describe, expect, it } from "vitest";

import { gridBlock } from "../__fixtures__/build";
import {
  BOX,
  editorState,
  KIT_PART_1,
  KIT_PART_2,
  layoutOne,
  TRAY_PARCEL,
  vehicleOf,
} from "../__fixtures__/editor";

import { kitRefs, peerRefs, productRows, sizeKey, trayLines, vehicleStats } from "./selectors";

describe("sizeKey", () => {
  it("is the same whichever way the carton lies", () => {
    expect(sizeKey({ l: 400, w: 500, h: 300 })).toBe(sizeKey({ l: 300, w: 400, h: 500 }));
    expect(sizeKey({ l: 400, w: 500, h: 300 })).not.toBe(sizeKey({ l: 400, w: 500, h: 301 }));
  });
});

describe("trayLines", () => {
  it("groups identical parcels, keeps different sizes, rotation flags and kits apart", () => {
    const twin = { ...TRAY_PARCEL, ref: "TRAY-2" };
    const bigger = { ...TRAY_PARCEL, ref: "TRAY-3", origMm: { l: 900, w: 500, h: 300 } };
    const fixed = { ...TRAY_PARCEL, ref: "TRAY-4", rotatable: false };
    const kitA = { ...TRAY_PARCEL, ref: "TRAY-5", kitGroup: "A" };
    const kitB = { ...TRAY_PARCEL, ref: "TRAY-6", kitGroup: "B" };
    const lines = trayLines([TRAY_PARCEL, twin, bigger, fixed, kitA, kitB]);
    expect(lines.map((l) => l.parcels.map((p) => p.ref))).toEqual([
      ["TRAY-1", "TRAY-2"],
      ["TRAY-3"],
      ["TRAY-4"],
      ["TRAY-5"],
      ["TRAY-6"],
    ]);
    expect(lines[0].partName).toBe("Thùng BOX");
  });

  it("is empty for an empty tray", () => {
    expect(trayLines([])).toEqual([]);
  });
});

describe("peers and kits", () => {
  const [p1] = gridBlock({
    carton: KIT_PART_1,
    origin: { xMm: 0, yMm: 0, zMm: 0 },
    counts: { nx: 1, ny: 1, nz: 1 },
  });
  const [p2] = gridBlock({
    carton: KIT_PART_2,
    origin: { xMm: 400, yMm: 0, zMm: 0 },
    counts: { nx: 1, ny: 1, nz: 1 },
  });
  const vehicle = { ...vehicleOf(layoutOne), boxes: [...layoutOne.boxes, p1, p2] };

  it("peerRefs returns the boxes of the same item, size and pose", () => {
    expect(peerRefs(vehicle, "BOX-001")).toEqual(["BOX-001", "BOX-002"]);
    const turned = {
      ...vehicle,
      boxes: [
        layoutOne.boxes[0],
        { ...layoutOne.boxes[1], wMm: 400, dMm: 500, orientation: "WLH" as const },
      ],
    };
    expect(peerRefs(turned, "BOX-001")).toEqual(["BOX-001"]);
    expect(peerRefs(vehicle, "nope")).toEqual([]);
  });

  it("kitRefs returns every part of the kit on the vehicle, and nothing for a loose box", () => {
    expect(kitRefs(vehicle, "KIT1-001")).toEqual(["KIT1-001", "KIT2-001"]);
    expect(kitRefs(vehicle, "BOX-001")).toEqual([]);
  });
});

describe("vehicleStats and productRows", () => {
  it("sums weight and volume against the vehicle's capacity", () => {
    const stats = vehicleStats(editorState().vehicles[0]);
    expect(stats.count).toBe(2);
    expect(stats.weightKg).toBe(2 * BOX.weightKg);
    expect(stats.weightPct).toBeCloseTo(0.2);
    expect(stats.volumePct).toBeCloseTo((2 * 500 * 300 * 400) / (2000 * 1000 * 1000));
  });

  it("lists one row per item and size with its refs, regardless of pose", () => {
    const vehicle = editorState().vehicles[0];
    const rows = productRows({
      ...vehicle,
      boxes: [vehicle.boxes[0], { ...vehicle.boxes[1], wMm: 400, dMm: 500, orientation: "WLH" }],
    });
    expect(rows).toEqual([
      {
        key: expect.any(String),
        partName: "Thùng BOX",
        dims: BOX.origMm,
        refs: ["BOX-001", "BOX-002"],
      },
    ]);
  });
});
