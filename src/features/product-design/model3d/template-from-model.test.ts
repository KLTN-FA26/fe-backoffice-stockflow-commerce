import { describe, expect, it } from "vitest";

import { customizationTemplateSchema, type BagModel, type CupModel } from "./model-types";
import { templateFromModel } from "./template-from-model";

const cup = (over: Partial<CupModel> = {}): CupModel => ({
  kind: "parametric-cup",
  topDiameterMm: 90,
  bottomDiameterMm: 60,
  heightMm: 110,
  rimMm: 3,
  seamMm: 8,
  bandTopOffsetMm: 6,
  bandBottomOffsetMm: 8,
  material: "paper-white",
  ...over,
});

const bag = (over: Partial<BagModel> = {}): BagModel => ({
  kind: "parametric-bag",
  widthMm: 260,
  gussetMm: 120,
  heightMm: 280,
  topFoldMm: 0,
  handle: "twisted",
  material: "kraft-brown",
  ...over,
});

const codes = (...list: ("BODY" | "FRONT" | "BACK" | "LEFT" | "RIGHT")[]) =>
  list.map((printAreaCode) => ({ printAreaCode }));

describe("templateFromModel: cup", () => {
  // The storefront also compared with its `cup12oz` fixture; the area literal below is that fixture's.
  it("describes the same print area as the 12 oz cup of the mock (CUP12-BODY)", () => {
    const template = templateFromModel(cup(), codes("BODY"));
    expect(template.printAreas).toHaveLength(1);
    const [area] = template.printAreas;
    expect(area).toEqual({
      code: "BODY",
      name: "Thân ly",
      xMm: 0,
      yMm: 0,
      widthMm: 279.67,
      heightMm: 120.85,
      safeMarginMm: 3,
      bleedMm: 2,
      shape: {
        type: "annular-sector",
        innerRadiusMm: 230.04,
        outerRadiusMm: 327.05,
        sweepRad: 0.84894,
        seamMm: 8,
      },
      uvMapping: { meshPart: "body" },
    });
  });

  it("parses with the template schema, for the seam the measuring defaults give too", () => {
    const template = templateFromModel(cup({ seamMm: 5 }), codes("BODY"));
    expect(customizationTemplateSchema.safeParse(template).success).toBe(true);
    // The storefront also checked here that the surface's bleed box is larger than the area's box;
    // the surfaces are not part of the back-office, so only the parse stays.
  });

  it("uses the model, the file rules and the colour mode of the defaults", () => {
    const template = templateFromModel(cup({ material: "kraft" }), codes("BODY"));
    expect(template.model).toEqual(cup({ material: "kraft" }));
    expect(template).toMatchObject({
      minDpi: 300,
      allowedFileFormats: ["image/png", "image/jpeg"],
      maxFileSizeMb: 50,
      colorMode: "CMYK",
      maxColors: null,
      allowedFontCodes: null,
    });
  });

  it("takes other margins from the defaults argument", () => {
    const template = templateFromModel(cup(), codes("BODY"), {
      cup: { safeMarginMm: 4, bleedMm: 3, maxColors: null },
    });
    expect(template.printAreas[0]).toMatchObject({ safeMarginMm: 4, bleedMm: 3 });
    expect(customizationTemplateSchema.safeParse(template).success).toBe(true);
  });

  it("unrolls a straight cup as a rect and still parses", () => {
    const template = templateFromModel(
      cup({ topDiameterMm: 80, bottomDiameterMm: 80, bandTopOffsetMm: 10, bandBottomOffsetMm: 10 }),
      codes("BODY"),
    );
    const [area] = template.printAreas;
    expect(area?.shape).toEqual({ type: "rect" });
    expect(customizationTemplateSchema.safeParse(template).success).toBe(true);
    // trim size: circumference plus seam wide, slant minus the offsets high
    expect(area?.widthMm).toBeCloseTo(Math.PI * 80 + 8, 1);
    expect(area?.heightMm).toBeCloseTo(110 - 20, 1);
  });
});

describe("templateFromModel: bag", () => {
  it("makes a rect print area for each face the file has, in the order front, back, left, right", () => {
    const template = templateFromModel(bag(), codes("RIGHT", "FRONT", "BACK", "LEFT"));
    expect(template.printAreas.map((a) => a.code)).toEqual(["FRONT", "BACK", "LEFT", "RIGHT"]);
    expect(template.printAreas.map((a) => a.widthMm)).toEqual([260, 260, 120, 120]);
    expect(template.printAreas.every((a) => a.heightMm === 280)).toBe(true);
    expect(template.printAreas.every((a) => a.shape.type === "rect")).toBe(true);
    // the four faces of the storefront's `bagM` fixture (height 280 = 320 - 40 top fold)
    const face = (code: "FRONT" | "BACK" | "LEFT" | "RIGHT", name: string, widthMm: number) => ({
      code,
      name,
      xMm: 0,
      yMm: 0,
      widthMm,
      heightMm: 280,
      safeMarginMm: 5,
      bleedMm: 3,
      shape: { type: "rect" },
      uvMapping: { meshPart: code.toLowerCase() },
    });
    expect(template.printAreas).toEqual([
      face("FRONT", "Mặt trước", 260),
      face("BACK", "Mặt sau", 260),
      face("LEFT", "Hông trái", 120),
      face("RIGHT", "Hông phải", 120),
    ]);
    // No ink limit by default (the BE's null): a guessed 4 used to show on every storefront picture.
    expect(template.maxColors).toBeNull();
    expect(customizationTemplateSchema.safeParse(template).success).toBe(true);
  });

  it("leaves out the faces the file does not have", () => {
    const template = templateFromModel(bag(), codes("FRONT", "LEFT"));
    expect(template.printAreas.map((a) => a.code)).toEqual(["FRONT", "LEFT"]);
  });

  it("takes the printable height off the top fold", () => {
    const template = templateFromModel(bag({ heightMm: 320, topFoldMm: 40 }), codes("FRONT"));
    expect(template.printAreas[0]?.heightMm).toBe(280);
  });

  it("refuses a bag with no faces", () => {
    expect(() => templateFromModel(bag(), [])).toThrow();
  });
});
