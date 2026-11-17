/** The values the `.glb` determines, compared as the BE compares them (`ModelFileRules`, origin/develop d47ed4ae). */
import { describe, expect, it } from "vitest";

import { bagHeightFor, measuredChanged } from "./measured";
import {
  incompleteSurfaces,
  looseSurfaceFaults,
  sameSurfaces,
  surfaceFaultMessage,
  surfaceFaults,
} from "./surfaces";
import { BAG_BODY, CUP } from "./test-fixtures";

import type { BagModel } from "./model3d";

const BAG = BAG_BODY.model as BagModel;

describe("measuredChanged", () => {
  it("a cup: the diameters, the height and the band offsets; not seam, rim or material", () => {
    for (const key of [
      "topDiameterMm",
      "bottomDiameterMm",
      "heightMm",
      "bandTopOffsetMm",
      "bandBottomOffsetMm",
    ] as const) {
      expect(measuredChanged(CUP, { ...CUP, [key]: CUP[key] + 0.01 })).toBe(true);
    }
    expect(measuredChanged(CUP, { ...CUP, seamMm: 1, rimMm: 9, material: "kraft" })).toBe(false);
  });

  it("in hundredths of a millimetre, rounded half up like Java's Math.round", () => {
    expect(measuredChanged({ ...CUP, heightMm: 0.12 }, { ...CUP, heightMm: 0.125 })).toBe(true); // half up: 13
    expect(measuredChanged({ ...CUP, heightMm: 0.13 }, { ...CUP, heightMm: 0.125 })).toBe(false);
    expect(measuredChanged(CUP, { ...CUP, heightMm: 110.004 })).toBe(false);
    expect(measuredChanged(CUP, { ...CUP, heightMm: 110.006 })).toBe(true);
  });

  it("a bag: width, gusset and height less fold; the fold moves freely with the height", () => {
    expect(measuredChanged(BAG, { ...BAG, widthMm: BAG.widthMm + 1 })).toBe(true);
    expect(measuredChanged(BAG, { ...BAG, gussetMm: BAG.gussetMm - 1 })).toBe(true);
    expect(measuredChanged(BAG, { ...BAG, heightMm: BAG.heightMm + 5 })).toBe(true);
    expect(
      measuredChanged(BAG, { ...BAG, heightMm: BAG.heightMm + 5, topFoldMm: BAG.topFoldMm + 5 }),
    ).toBe(false);
    expect(measuredChanged(BAG, { ...BAG, handle: "none", material: "kraft-white" })).toBe(false);
  });

  it("another kind, or no stored model at all, is a change", () => {
    expect(measuredChanged(CUP, BAG)).toBe(true);
    expect(measuredChanged(null, CUP)).toBe(true);
  });
});

describe("bagHeightFor", () => {
  it("the same fold keeps the height exactly as read (no arithmetic to round)", () => {
    const odd = { ...BAG, heightMm: 310.1234567, topFoldMm: 30.3 };
    expect(bagHeightFor(odd, 30.3)).toBe(310.1234567);
  });

  it("a new fold keeps the printed height the BE compares, even where plain arithmetic would drift", () => {
    const tricky = { ...BAG, heightMm: 100.006, topFoldMm: 10.004 };
    const height = bagHeightFor(tricky, 10);
    expect(measuredChanged(tricky, { ...tricky, heightMm: height, topFoldMm: 10 })).toBe(false);
    // plain arithmetic: 100.006 − 10.004 + 10 = 100.002, whose hundredths differ by one
    expect(
      measuredChanged(tricky, { ...tricky, heightMm: 100.006 - 10.004 + 10, topFoldMm: 10 }),
    ).toBe(true);
  });
});

describe("the area ↔ mesh table", () => {
  const FACES = ["FRONT", "BACK", "LEFT", "RIGHT"];

  it("loose faults (always): an unknown area, an area twice", () => {
    const faults = looseSurfaceFaults(
      ["BODY"],
      [
        { printAreaCode: "BODY", meshName: "print:BODY" },
        { printAreaCode: "BODY", meshName: "print:BODY" },
        { printAreaCode: "FRONT", meshName: "print:FRONT" },
      ],
    );
    expect(faults).toEqual([
      { kind: "duplicate", index: 1, code: "BODY" },
      { kind: "unknown", index: 2, code: "FRONT" },
    ]);
  });

  it("with a file: every area once, on print:<code> (trimmed, as the BE stores it)", () => {
    const faults = incompleteSurfaces(FACES, [
      { printAreaCode: "FRONT", meshName: " print:FRONT " },
      { printAreaCode: "BACK", meshName: "Back" },
      { printAreaCode: "LEFT", meshName: "print:LEFT" },
    ]);
    expect(faults).toEqual([
      { kind: "meshName", index: 1, code: "BACK" },
      { kind: "missing", code: "RIGHT" },
    ]);
    expect(faults.map(surfaceFaultMessage)).toEqual([
      "Mesh của vùng in BACK phải tên là print:BACK.",
      "Vùng in RIGHT chưa có mesh print:RIGHT trong file.",
    ]);
    expect(surfaceFaults(FACES, BAG_BODY.surfaces)).toEqual([]);
  });

  it("sameSurfaces: the same pairs in any order", () => {
    expect(sameSurfaces(BAG_BODY.surfaces, [...BAG_BODY.surfaces].reverse())).toBe(true);
    expect(sameSurfaces(BAG_BODY.surfaces, BAG_BODY.surfaces.slice(1))).toBe(false);
    expect(
      sameSurfaces(
        [{ printAreaCode: "BODY", meshName: "print:BODY" }],
        [{ printAreaCode: "BODY", meshName: "print:BODY2" }],
      ),
    ).toBe(false);
  });
});
