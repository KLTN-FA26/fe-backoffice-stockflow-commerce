import { describe, expect, it } from "vitest";

import { templateDifferences } from "./compare-template";
import { bandVRangeOf } from "./cup-sector";

import type { BandShape, FaceShape } from "./measure-types";
import type { BagModel, CupModel } from "./model-types";

// Adapted from the "tolerance at exactly 1 mm" tests of the storefront's model3d-scene.test.ts,
// which went through `buildGlbScene`; here the comparison is called directly with the band the
// file would measure as (a straight cup whose figures are round numbers, so +1.0 is exact).
const straightCup: CupModel = {
  kind: "parametric-cup",
  topDiameterMm: 80,
  bottomDiameterMm: 80,
  heightMm: 100,
  rimMm: 3,
  seamMm: 5,
  bandTopOffsetMm: 10,
  bandBottomOffsetMm: 10,
  material: "paper-white",
};
const exactBand: BandShape = {
  kind: "band",
  topYMm: 90,
  bottomYMm: 10,
  topDiameterMm: 80,
  bottomDiameterMm: 80,
};

const bandDifferences = (shape: BandShape, model: CupModel = straightCup) =>
  templateDifferences({ code: "BODY", surface: { vRange: bandVRangeOf(model) }, shape }, model);

describe("templateDifferences: cup band", () => {
  it("reads the straight cup's band as v 10 to 90", () => {
    expect(bandVRangeOf(straightCup)).toEqual([10, 90]);
  });

  it("accepts the exact figures", () => {
    expect(bandDifferences(exactBand)).toEqual([]);
  });

  it("answers nothing for a mesh that failed its own checks", () => {
    expect(
      templateDifferences(
        { code: "BODY", surface: { vRange: bandVRangeOf(straightCup) }, shape: null },
        straightCup,
      ),
    ).toEqual([]);
  });

  it.each([
    ["band top Y", { topYMm: 91 }, { topYMm: 91.1 }, "Y đỉnh thân in"],
    ["band bottom Y", { bottomYMm: 11 }, { bottomYMm: 11.1 }, "Y đáy thân in"],
    ["top diameter", { topDiameterMm: 81 }, { topDiameterMm: 81.1 }, "đường kính đỉnh thân in"],
    [
      "bottom diameter",
      { bottomDiameterMm: 81 },
      { bottomDiameterMm: 81.1 },
      "đường kính đáy thân in",
    ],
  ])("%s: 1.0 mm off passes, 1.1 mm off is reported", (_label, pass, fail, text) => {
    expect(bandDifferences({ ...exactBand, ...pass })).toEqual([]);
    const out = bandDifferences({ ...exactBand, ...fail });
    expect(out).toHaveLength(1);
    expect(out[0]).toContain(text);
  });

  it("says a flat face is not a cup body", () => {
    const face: FaceShape = {
      kind: "face",
      widthMm: 100,
      heightMm: 100,
      bottomYMm: 0,
      offsetMm: 0,
      centreMm: 0,
    };
    expect(
      templateDifferences(
        { code: "BODY", surface: { vRange: bandVRangeOf(straightCup) }, shape: face },
        straightCup,
      ),
    ).toEqual(["BODY: file là mặt phẳng, mẫu là thân ly"]);
  });
});

describe("templateDifferences: bag faces", () => {
  const bag: BagModel = {
    kind: "parametric-bag",
    widthMm: 260,
    gussetMm: 120,
    heightMm: 320,
    topFoldMm: 40,
    handle: "twisted",
    material: "kraft-brown",
  };
  const surface = { vRange: [0, 280] as const };
  const front: FaceShape = {
    kind: "face",
    widthMm: 260,
    heightMm: 280,
    bottomYMm: 0,
    offsetMm: 60,
    centreMm: 0,
  };

  it("accepts a face that is the template's face", () => {
    expect(templateDifferences({ code: "FRONT", surface, shape: front }, bag)).toEqual([]);
  });

  it("reports width, plane and a sideways shift past 1 mm", () => {
    const out = templateDifferences(
      {
        code: "FRONT",
        surface,
        shape: { ...front, widthMm: 262, offsetMm: 58.5, centreMm: 1.5 },
      },
      bag,
    );
    expect(out).toEqual([
      "FRONT rộng: file 262 mm, mẫu 260 mm",
      "FRONT vị trí mặt: file 58.5 mm, mẫu 60 mm",
      "FRONT lệch tâm theo chiều ngang 1.5 mm (tâm file 1.5 mm, mẫu 0 mm)",
    ]);
  });

  it("says a cup body is not a bag face", () => {
    expect(templateDifferences({ code: "FRONT", surface, shape: exactBand }, bag)).toEqual([
      "FRONT: file là thân ly, mẫu là mặt túi",
    ]);
  });
});
