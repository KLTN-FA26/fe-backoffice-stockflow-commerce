import { describe, expect, it } from "vitest";

import { bagSheet } from "../bag-sheet";
import { CUP } from "../test-fixtures";
import { defaultsFor } from "./print-defaults";
import { buildSaveInput } from "./save-input";
import { sheetOfForm } from "./sheet-of-form";

import type { BagModel } from "../model3d/model-types";

/** A bag as `measureBag` reads it: the face height, no top fold yet. */
const MEASURED: BagModel = {
  kind: "parametric-bag",
  widthMm: 260,
  gussetMm: 120,
  heightMm: 280,
  topFoldMm: 0,
  handle: "twisted",
  material: "kraft-brown",
};
const FACES = (["FRONT", "BACK", "LEFT", "RIGHT"] as const).map((code) => ({
  printAreaCode: code,
  meshName: `print:${code}`,
}));
const source = { model: MEASURED, printMeshes: FACES };
const defaults = { ...defaultsFor("parametric-bag", null, MEASURED), topFoldMm: 40 };

describe("sheetOfForm", () => {
  it("draws the sheet the save would send: the pinned 780 × 392, bleed box 786 × 398", () => {
    const sheet = sheetOfForm({ source, stored: null, defaults });
    expect(sheet).toMatchObject({
      trimWidthMm: 780,
      trimHeightMm: 392,
      bleedWidthMm: 786,
      bleedHeightMm: 398,
    });
    const input = buildSaveInput({ source, stored: null, defaults });
    if (input?.config.model.kind !== "parametric-bag") throw new Error("expected a bag");
    expect(sheet).toEqual(bagSheet(input.config.model, input.config.printAreas));
  });

  it("follows the glue flap and bottom fold typed", () => {
    const sheet = sheetOfForm({
      source,
      stored: null,
      defaults: { ...defaults, glueFlapMm: 30, bottomFoldMm: 50 },
    });
    expect(sheet).toMatchObject({ trimWidthMm: 790, trimHeightMm: 370 });
  });

  it.each(["glueFlapMm", "bottomFoldMm", "topFoldMm", "bleedMm"] as const)(
    "draws nothing while %s is half-typed or negative",
    (field) => {
      expect(
        sheetOfForm({ source, stored: null, defaults: { ...defaults, [field]: NaN } }),
      ).toBeNull();
      expect(
        sheetOfForm({ source, stored: null, defaults: { ...defaults, [field]: -1 } }),
      ).toBeNull();
    },
  );

  it("draws nothing for a cup, or with nothing to draw from", () => {
    const cupSource = {
      model: CUP,
      printMeshes: [{ printAreaCode: "BODY" as const, meshName: "print:BODY" }],
    };
    expect(sheetOfForm({ source: cupSource, stored: null, defaults })).toBeNull();
    expect(sheetOfForm({ source: null, stored: null, defaults })).toBeNull();
  });
});
