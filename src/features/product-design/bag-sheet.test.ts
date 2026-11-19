import { describe, expect, it } from "vitest";

import { bagSheet, defaultBottomFoldMm } from "./bag-sheet";

import type { BagModel } from "./model3d/model-types";

/** The example pinned in the BE's `BagSheetTest` and the storefront's `bag-sheet.test.ts` (spec 2026-11-18 §3). */
const PINNED: BagModel = {
  kind: "parametric-bag",
  widthMm: 260,
  gussetMm: 120,
  heightMm: 320,
  topFoldMm: 40,
  glueFlapMm: 20,
  bottomFoldMm: 72,
  handle: "twisted",
  material: "kraft-brown",
};
const AREAS = [{ bleedMm: 3 }, { bleedMm: 3 }, { bleedMm: 3 }, { bleedMm: 3 }];

describe("bagSheet (BE BagSheet, storefront bagSheet)", () => {
  it("W 260, g 120, H 320, T 40, G 20, B 72, b 3 → P 280, trim 780 × 392, bleed box 786 × 398", () => {
    const sheet = bagSheet(PINNED, AREAS);
    expect(sheet.printedHeightMm).toBe(280);
    expect(sheet.trimWidthMm).toBe(780);
    expect(sheet.trimHeightMm).toBe(392);
    expect(sheet.bleedWidthMm).toBe(786);
    expect(sheet.bleedHeightMm).toBe(398);
    expect(sheet.assumed).toBe(false);
  });

  it("lays FRONT, RIGHT, BACK, LEFT after the glue flap, below the top fold", () => {
    const { sides } = bagSheet(PINNED, AREAS);
    expect(sides).toEqual({
      FRONT: { x: 20, y: 40, width: 260, height: 280 },
      RIGHT: { x: 280, y: 40, width: 120, height: 280 },
      BACK: { x: 400, y: 40, width: 260, height: 280 },
      LEFT: { x: 660, y: 40, width: 120, height: 280 },
    });
  });

  it("folds at G, G+W, G+W+g/2, G+W+g, G+2W+g, G+2W+1.5g and at T, T+P; columns and rows in mm", () => {
    const sheet = bagSheet(PINNED, AREAS);
    expect(sheet.verticalFolds).toEqual([20, 280, 340, 400, 660, 720]);
    expect(sheet.horizontalFolds).toEqual([40, 320]);
    expect(sheet.columnsMm).toEqual([20, 260, 120, 260, 120]);
    expect(sheet.rowsMm).toEqual([40, 280, 72]);
  });

  it("the bleed is the largest of the four areas'", () => {
    const sheet = bagSheet(PINNED, [
      { bleedMm: 1 },
      { bleedMm: 5 },
      { bleedMm: 2 },
      { bleedMm: 0 },
    ]);
    expect(sheet.bleedMm).toBe(5);
    expect(sheet.bleedWidthMm).toBe(790);
  });

  it("P is round2(H) − round2(T), each rounded first as the template keeps them", () => {
    const sheet = bagSheet({ ...PINNED, heightMm: 320.004, topFoldMm: 39.996 }, AREAS);
    expect(sheet.printedHeightMm).toBeCloseTo(280, 9);
  });

  it("a bag stored before the flat sheet takes the BE's defaults: glue flap 20, bottom fold round2(0.6 × gusset)", () => {
    const legacy: BagModel = {
      kind: "parametric-bag",
      widthMm: 260,
      gussetMm: 120,
      heightMm: 320,
      topFoldMm: 40,
      handle: "twisted",
      material: "kraft-brown",
    };
    const sheet = bagSheet(legacy, AREAS);
    expect(sheet.glueFlapMm).toBe(20);
    expect(sheet.bottomFoldMm).toBe(72);
    expect(sheet.trimWidthMm).toBe(780);
    expect(sheet.trimHeightMm).toBe(392);
    expect(sheet.assumed).toBe(true);
  });
});

describe("defaultBottomFoldMm (BE BagModel.defaultBottomFoldMm)", () => {
  it.each([
    [120, 72],
    [110, 66],
    [0, 0],
    [83.33, 50],
    [100.005, 60],
  ])("gusset %s → %s", (gusset, fold) => {
    expect(defaultBottomFoldMm(gusset)).toBe(fold);
  });
});
