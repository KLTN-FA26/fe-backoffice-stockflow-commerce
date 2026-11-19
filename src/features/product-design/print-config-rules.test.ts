/**
 * BE `PrintConfigRules` (origin/develop 3672ffb7) as the screen checks them before a save, at their limits: the value
 * the BE takes passes, the next hundredth is refused, on the field the BE names.
 */
import { describe, expect, it } from "vitest";

import { cupSector } from "./model3d/cup-sector";
import { geometryFaults, measuredFaults } from "./print-config-rules";
import { BAG_BODY, CUP } from "./test-fixtures";

import type { BagModel, CupModel } from "./model3d";
import type { GeometryInput } from "./print-config-rules";

const BAG = BAG_BODY.model as BagModel;
const typed = (d: Partial<GeometryInput> = {}): GeometryInput => ({
  seamMm: 8,
  topFoldMm: 30,
  safeMarginMm: 3,
  bleedMm: 2,
  ...d,
});
const fieldsOf = (model: CupModel | BagModel, d: Partial<GeometryInput>) =>
  geometryFaults(model, typed(d)).map((fault) => fault.field);
const keysOf = (model: CupModel | BagModel) => measuredFaults(model).map((fault) => fault.key);

/** A cup almost flat (a dish): its unrolled band nearly closes a full turn, its apex is close to the base. */
const DISH: CupModel = {
  ...CUP,
  topDiameterMm: 200,
  bottomDiameterMm: 20,
  heightMm: 10,
  bandTopOffsetMm: 0,
  bandBottomOffsetMm: 0,
};
/** A straight wall: unrolled as a rectangle (BE `CupGeometry.isCylindrical`). */
const STRAIGHT: CupModel = {
  ...CUP,
  topDiameterMm: 80,
  bottomDiameterMm: 80,
  heightMm: 100,
  bandTopOffsetMm: 5,
  bandBottomOffsetMm: 5,
};

describe("measuredFaults: the figures read from the file (BE requireCup / requireBag)", () => {
  it("the sample cup and bag pass", () => {
    expect(measuredFaults(CUP)).toEqual([]);
    expect(measuredFaults(BAG)).toEqual([]);
  });

  it.each([
    ["topDiameterMm", 2000, 2000.01],
    ["heightMm", 2000, 2000.01],
  ] as const)("a cup's %s is at most 2000 mm (Range)", (key, ok, refused) => {
    expect(keysOf({ ...CUP, [key]: ok })).toEqual([]);
    expect(keysOf({ ...CUP, [key]: refused })).toEqual([key]);
  });

  it("a cup's sizes are more than 0 (requirePositive)", () => {
    expect(keysOf({ ...CUP, heightMm: 0 })).toEqual(["heightMm"]);
  });

  it("a band offset is 0 to 2000 mm (requireNonNegative)", () => {
    expect(keysOf({ ...CUP, bandTopOffsetMm: 0 })).toEqual([]);
    expect(keysOf({ ...CUP, bandTopOffsetMm: -0.01 })).toEqual(["bandTopOffsetMm"]);
    expect(keysOf({ ...CUP, bandBottomOffsetMm: 2000.01 })).toEqual(["bandBottomOffsetMm"]);
  });

  it("a cup's diameters and height are at least 10 mm (MIN_CUP_DIAMETER_MM)", () => {
    expect(keysOf({ ...CUP, bottomDiameterMm: 10 })).toEqual([]);
    expect(keysOf({ ...CUP, bottomDiameterMm: 9.99 })).toEqual(["bottomDiameterMm"]);
    expect(keysOf({ ...CUP, heightMm: 9.99 })).toEqual(["heightMm"]);
    expect(measuredFaults({ ...CUP, heightMm: 9.99 })[0]?.message).toContain("nhỏ hơn 10 mm");
  });

  it("a cup's base is not wider than its rim (BaseWiderThanRim)", () => {
    expect(keysOf({ ...CUP, bottomDiameterMm: 90 })).toEqual([]);
    expect(keysOf({ ...CUP, bottomDiameterMm: 90.01 })).toEqual(["bottomDiameterMm"]);
    expect(measuredFaults({ ...CUP, bottomDiameterMm: 90.01 })[0]?.message).toContain(
      "rộng hơn miệng",
    );
  });

  it("the unprinted offsets leave a band (NoBand: offsets < slant 111.018 mm)", () => {
    expect(keysOf({ ...CUP, bandTopOffsetMm: 55.5, bandBottomOffsetMm: 55.5 })).toEqual([]);
    const none = { ...CUP, bandTopOffsetMm: 55.51, bandBottomOffsetMm: 55.51 };
    expect(keysOf(none)).toEqual(["bandTopOffsetMm"]);
    expect(measuredFaults(none)[0]?.message).toContain("không còn dải để in");
  });

  it("a bag's width and gusset are more than 0 and at most 2000 mm", () => {
    expect(keysOf({ ...BAG, widthMm: 2000 })).toEqual([]);
    expect(keysOf({ ...BAG, widthMm: 2000.01 })).toEqual(["widthMm"]);
    expect(keysOf({ ...BAG, gussetMm: 0 })).toEqual(["gussetMm"]);
  });
});

describe("geometryFaults: a cup (BE cupAreas)", () => {
  it("the sample cup with its defaults passes", () => {
    expect(geometryFaults(CUP, typed())).toEqual([]);
  });

  it("SeamOverlaps on seamMm: the sweep and the glue flap stay under one turn", () => {
    const s = cupSector(DISH);
    const limit = (2 * Math.PI - s.sweepRad) * s.trimInnerMm; // about 0.38 mm for this dish
    expect(fieldsOf(DISH, { seamMm: limit - 0.001, bleedMm: 0, safeMarginMm: 0 })).toEqual([]);
    expect(fieldsOf(DISH, { seamMm: limit, bleedMm: 0, safeMarginMm: 0 })).toEqual(["seamMm"]);
    const [fault] = geometryFaults(DISH, typed({ seamMm: 1, bleedMm: 0, safeMarginMm: 0 }));
    expect(fault?.message).toBe(
      "Mép dán phải ngắn hơn 0,39 mm: dài hơn thì dải in trải phẳng của ly chồng lên chính nó.",
    );
  });

  it("BleedPastCentre on bleedMm: the bleed stays inside the band's inner radius", () => {
    const inner = cupSector(DISH).trimInnerMm; // about 10.06 mm
    const ok = Math.floor(inner * 100) / 100;
    expect(fieldsOf(DISH, { seamMm: 0, bleedMm: ok, safeMarginMm: 0 })).toEqual([]);
    expect(fieldsOf(DISH, { seamMm: 0, bleedMm: ok + 0.01, safeMarginMm: 0 })).toEqual(["bleedMm"]);
  });

  it("NoSafeArea on safeMarginMm: twice the margin under the band's height (97.018 mm)", () => {
    expect(fieldsOf(CUP, { safeMarginMm: 48.5 })).toEqual([]);
    expect(fieldsOf(CUP, { safeMarginMm: 48.51 })).toEqual(["safeMarginMm"]);
    expect(geometryFaults(CUP, typed({ safeMarginMm: 60 }))[0]?.message).toContain(
      "Lề an toàn phải nhỏ hơn 48,51 mm",
    );
  });

  it("NoSafeArea is checked on the margin as stored, in hundredths", () => {
    expect(fieldsOf(CUP, { safeMarginMm: 48.504 })).toEqual([]); // stored 48.50
    expect(fieldsOf(CUP, { safeMarginMm: 48.505 })).toEqual(["safeMarginMm"]); // stored 48.51
  });

  it("a straight wall: the margin against the band's height (90 mm)", () => {
    expect(fieldsOf(STRAIGHT, { safeMarginMm: 44.99 })).toEqual([]);
    expect(fieldsOf(STRAIGHT, { safeMarginMm: 45 })).toEqual(["safeMarginMm"]);
    expect(fieldsOf(STRAIGHT, { seamMm: 100, bleedMm: 20 })).toEqual([]); // no sector, no overlap
  });

  it("nothing is checked on a cup the BE refuses for its own figures", () => {
    expect(geometryFaults({ ...CUP, bottomDiameterMm: 95 }, typed({ safeMarginMm: 400 }))).toEqual(
      [],
    );
  });
});

describe("geometryFaults: a bag (BE bagAreas)", () => {
  it("NoSafeArea: the margin against the narrowest side, the gusset (110 mm)", () => {
    expect(fieldsOf(BAG, { safeMarginMm: 54.99 })).toEqual([]);
    expect(fieldsOf(BAG, { safeMarginMm: 55 })).toEqual(["safeMarginMm"]);
  });

  it("the printed height (face 280 mm) is not changed by the fold", () => {
    const short = { ...BAG, gussetMm: 400, widthMm: 400 };
    expect(fieldsOf(short, { safeMarginMm: 139.99, topFoldMm: 80 })).toEqual([]);
    expect(fieldsOf(short, { safeMarginMm: 140, topFoldMm: 80 })).toEqual(["safeMarginMm"]);
  });

  it("the sent height, face plus fold, is at most 2000 mm (requirePositive)", () => {
    expect(fieldsOf(BAG, { topFoldMm: 1720 })).toEqual([]);
    expect(fieldsOf(BAG, { topFoldMm: 1720.01 })).toEqual(["topFoldMm"]);
    expect(geometryFaults(BAG, typed({ topFoldMm: 1800 }))[0]?.message).toBe(
      "Gập miệng tối đa 1.720,00 mm: mặt túi cộng gập miệng không được quá 2000 mm.",
    );
  });
});
