import { describe, expect, it } from "vitest";

import { LAYOUT_40HC, LAYOUT_PICKUP_KIT } from "./__fixtures__/layouts";
import { BlockMmSchema, LayoutBoxSchema, LayoutSchema, UnplacedLineSchema } from "./schemas";

const BOX = LAYOUT_PICKUP_KIT.boxes[0];

describe("LayoutSchema (design v2 §5)", () => {
  it("parses the realistic fixtures unchanged", () => {
    expect(LayoutSchema.parse(LAYOUT_40HC)).toEqual(LAYOUT_40HC);
    expect(LayoutSchema.parse(LAYOUT_PICKUP_KIT)).toEqual(LAYOUT_PICKUP_KIT);
  });

  it("parses what survives a JSON round trip (the shape BE sends)", () => {
    expect(LayoutSchema.parse(JSON.parse(JSON.stringify(LAYOUT_40HC)))).toEqual(LAYOUT_40HC);
  });

  it("reads an absent or null kitGroup as null", () => {
    const { kitGroup: _kitGroup, ...withoutKit } = BOX;
    expect(LayoutBoxSchema.parse(withoutKit).kitGroup).toBeNull();
    expect(LayoutBoxSchema.parse({ ...BOX, kitGroup: null }).kitGroup).toBeNull();
    expect(LayoutBoxSchema.parse({ ...BOX, kitGroup: "KIT-1" }).kitGroup).toBe("KIT-1");
  });

  it("accepts an empty vehicle", () => {
    expect(
      LayoutSchema.safeParse({ ...LAYOUT_PICKUP_KIT, boxes: [], usedVolumeMm3: 0, usedWeightKg: 0 })
        .success,
    ).toBe(true);
  });

  it.each([
    ["a missing field", { ...LAYOUT_PICKUP_KIT, innerMm: undefined }],
    ["seq 0", { ...LAYOUT_PICKUP_KIT, seq: 0 }],
    ["a fractional seq", { ...LAYOUT_PICKUP_KIT, seq: 1.5 }],
    ["an empty vehicle code", { ...LAYOUT_PICKUP_KIT, code: "" }],
    ["a zero inner dimension", { ...LAYOUT_PICKUP_KIT, innerMm: { l: 1800, w: 0, h: 500 } }],
    ["a negative payload", { ...LAYOUT_PICKUP_KIT, maxPayloadKg: -1 }],
    ["NaN used volume", { ...LAYOUT_PICKUP_KIT, usedVolumeMm3: Number.NaN }],
    ["Infinity used weight", { ...LAYOUT_PICKUP_KIT, usedWeightKg: Number.POSITIVE_INFINITY }],
    ["boxes that are not an array", { ...LAYOUT_PICKUP_KIT, boxes: {} }],
    [
      "a gusset with zero size",
      { ...LAYOUT_PICKUP_KIT, gussets: [{ xMm: 0, yMm: 0, zMm: 0, wMm: 0, hMm: 1, dMm: 1 }] },
    ],
  ])("rejects %s", (_name, value) => {
    expect(LayoutSchema.safeParse(value).success).toBe(false);
  });
});

describe("LayoutBoxSchema", () => {
  it.each([
    ["a negative coordinate", { ...BOX, xMm: -1 }],
    ["a zero-size box", { ...BOX, dMm: 0 }],
    ["an unknown orientation", { ...BOX, orientation: "XYZ" }],
    ["a lowercase orientation", { ...BOX, orientation: "lwh" }],
    ["a repeated-axis orientation", { ...BOX, orientation: "LLH" }],
    ["an empty ref", { ...BOX, ref: "" }],
    ["a negative weight", { ...BOX, weightKg: -0.1 }],
    ["string coordinates", { ...BOX, yMm: "0" }],
    ["incomplete nominal dims", { ...BOX, origMm: { l: 1, w: 1 } }],
    ["a missing rotatable flag (BR-10 needs it)", { ...BOX, rotatable: undefined }],
    ["a non-boolean rotatable flag", { ...BOX, rotatable: "true" }],
  ])("rejects %s", (_name, value) => {
    expect(LayoutBoxSchema.safeParse(value).success).toBe(false);
  });

  it("accepts all six orientations", () => {
    for (const orientation of ["LWH", "LHW", "WLH", "WHL", "HLW", "HWL"]) {
      expect(LayoutBoxSchema.safeParse({ ...BOX, orientation }).success).toBe(true);
    }
  });

  it("ignores unknown extra fields from a newer BE", () => {
    expect(LayoutBoxSchema.parse({ ...BOX, somethingNew: 1 })).toEqual(BOX);
  });
});

describe("BlockMmSchema", () => {
  it("allows a block at the origin", () => {
    expect(
      BlockMmSchema.safeParse({ xMm: 0, yMm: 0, zMm: 0, wMm: 1, hMm: 1, dMm: 1 }).success,
    ).toBe(true);
  });
});

describe("UnplacedLineSchema", () => {
  const line = {
    label: "BT-C",
    partName: "Bàn trà",
    origMm: { l: 1000, w: 600, h: 500 },
    quantity: 12,
  };

  it("parses a solver leftover line", () => {
    expect(UnplacedLineSchema.parse(line)).toEqual(line);
  });

  it.each([
    ["a missing quantity", { ...line, quantity: undefined }],
    ["a fractional quantity", { ...line, quantity: 1.5 }],
    ["a negative quantity", { ...line, quantity: -1 }],
    ["NaN", { ...line, quantity: Number.NaN }],
  ])("rejects %s (the original silently counted it as 1 or 0)", (_name, value) => {
    expect(UnplacedLineSchema.safeParse(value).success).toBe(false);
  });
});
