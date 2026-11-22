/**
 * The form's schema against BE `PrintConfigRules` (origin/develop 3672ffb7): each value's own limits, and, with the
 * model in play, the rules that need its sizes, each on the field the BE names.
 */
import { describe, expect, it } from "vitest";

import { BAG_BODY, CUP, cupDto } from "../test-fixtures";
import { defaultsFor, printDefaultsSchema, printDefaultsSchemaFor } from "./print-defaults";

import type { BagModel } from "../model3d";
import type { PrintDefaultsValues } from "./print-defaults";

const CUP_FORM = defaultsFor("parametric-cup", null);
const BAG_FORM = defaultsFor("parametric-bag", null);
const BAG = BAG_BODY.model as BagModel;

/** The fields refused, with their messages. */
function refused(schema: typeof printDefaultsSchema, values: PrintDefaultsValues) {
  const parsed = schema.safeParse(values);
  return parsed.success ? [] : parsed.error.issues.map((i) => [i.path.join("."), i.message]);
}

describe("printDefaultsSchema: each value on its own", () => {
  it.each([
    ["seamMm", 100, 100.01, "Tối đa 100 mm."], // MAX_SEAM_MM
    ["safeMarginMm", 500, 500.01, "Tối đa 500 mm."], // areas: safe margin ≤ 500
    ["rimMm", 2000, 2000.01, "Tối đa 2000 mm."], // requireNonNegative
    ["topFoldMm", 2000, 2000.01, "Tối đa 2000 mm."], // requireNonNegative
    ["bleedMm", 20, 20.01, "Tối đa 20 mm."], // areas: bleed ≤ 20 (already checked)
  ] as const)("%s: %d passes, %d is refused", (field, ok, over, message) => {
    expect(refused(printDefaultsSchema, { ...CUP_FORM, [field]: ok })).toEqual([]);
    expect(refused(printDefaultsSchema, { ...CUP_FORM, [field]: over })).toEqual([
      [field, message],
    ]);
  });

  it("without a model, only the values' own limits apply", () => {
    expect(printDefaultsSchemaFor(null)).toBe(printDefaultsSchema);
  });
});

describe("printDefaultsSchemaFor: with the model in play", () => {
  it("a cup: the safe margin against its band (97.018 mm) on safeMarginMm", () => {
    const schema = printDefaultsSchemaFor(CUP);
    expect(refused(schema, { ...CUP_FORM, safeMarginMm: 48.5 })).toEqual([]);
    expect(refused(schema, { ...CUP_FORM, safeMarginMm: 48.51 })).toEqual([
      [
        "safeMarginMm",
        "Lề an toàn phải nhỏ hơn 48,51 mm (một nửa cạnh ngắn nhất của vùng in), nếu không vùng in không còn chỗ in.",
      ],
    ]);
  });

  it("a bag: the margin against its gusset, the fold against the height, each on its field", () => {
    const schema = printDefaultsSchemaFor(BAG);
    expect(refused(schema, { ...BAG_FORM, safeMarginMm: 54.99, topFoldMm: 1720 })).toEqual([]);
    const fields = refused(schema, { ...BAG_FORM, safeMarginMm: 55, topFoldMm: 1720.01 }).map(
      ([path]) => path,
    );
    expect(fields).toEqual(["topFoldMm", "safeMarginMm"]);
  });

  it("the model's rules wait for the values to be numbers", () => {
    const fields = refused(printDefaultsSchemaFor(CUP), {
      ...CUP_FORM,
      seamMm: Number.NaN,
      safeMarginMm: 60,
    }).map(([path]) => path);
    expect(fields).toEqual(["seamMm"]);
  });
});

describe("printDefaultsSchema: the file rules (BE PrintConfigRules)", () => {
  const rules = (patch: Partial<PrintDefaultsValues>) => ({ ...CUP_FORM, ...patch });

  it.each([
    ["minDpi", 72, 71],
    ["minDpi", 2400, 2401],
    ["maxFileSizeMb", 1, 0],
    ["maxFileSizeMb", 50, 51],
    ["maxColors", 1, 0],
    ["maxColors", 12, 13],
  ] as const)("%s: %d passes, %d is refused on that field", (field, ok, over) => {
    expect(refused(printDefaultsSchema, rules({ [field]: ok }))).toEqual([]);
    expect(refused(printDefaultsSchema, rules({ [field]: over })).map(([path]) => path)).toEqual([
      field,
    ]);
  });

  it("maxColors 13 → Từ 1 đến 12", () => {
    expect(refused(printDefaultsSchema, rules({ maxColors: 13 }))).toEqual([
      ["maxColors", "Từ 1 đến 12."],
    ]);
  });

  it("maxColors null is no limit; a half-typed number is refused", () => {
    expect(refused(printDefaultsSchema, rules({ maxColors: null }))).toEqual([]);
    expect(refused(printDefaultsSchema, rules({ maxColors: Number.NaN }))).toEqual([
      ["maxColors", "Nhập một số."],
    ]);
  });

  it("a fractional dpi is refused (the BE takes an integer)", () => {
    expect(refused(printDefaultsSchema, rules({ minDpi: 300.5 })).map(([p]) => p)).toEqual([
      "minDpi",
    ]);
  });

  it("no format ticked, an empty font list or an unknown colour mode is refused on its field", () => {
    expect(refused(printDefaultsSchema, rules({ allowedFileFormats: [] }))).toEqual([
      ["allowedFileFormats", "Chọn ít nhất một định dạng."],
    ]);
    expect(refused(printDefaultsSchema, rules({ allowedFontCodes: [] }))).toEqual([
      ["allowedFontCodes", "Chọn ít nhất một font, hoặc chọn Mọi font."],
    ]);
    expect(refused(printDefaultsSchema, rules({ allowedFontCodes: null }))).toEqual([]);
    expect(refused(printDefaultsSchema, rules({ allowedFontCodes: ["lobster"] }))).toEqual([]);
  });
});

describe("printDefaultsSchemaFor: a bag's margin per area (BD-6)", () => {
  /** A stored bag whose LEFT face keeps a margin of its own, the form showing the first face's (5 mm). */
  const stored = cupDto({
    model: BAG,
    printAreas: (["FRONT", "BACK", "LEFT", "RIGHT"] as const).map((code) => ({
      code,
      name: code,
      xMm: 0,
      yMm: 0,
      widthMm: code === "FRONT" || code === "BACK" ? BAG.widthMm : BAG.gussetMm,
      heightMm: BAG.heightMm - BAG.topFoldMm,
      safeMarginMm: code === "LEFT" ? 60 : 5, // 2 × 60 = 120 ≥ the 110 mm gusset
      bleedMm: 3,
      shape: { type: "rect" as const },
      uvMapping: { meshPart: `print:${code}` },
    })),
  });
  const form = defaultsFor("parametric-bag", stored);

  it("the form shows the first face's margin, and the one the save keeps for LEFT is refused", () => {
    expect(form.safeMarginMm).toBe(5);
    expect(refused(printDefaultsSchemaFor(BAG), form)).toEqual([]); // one margin: nothing wrong
    const fields = refused(printDefaultsSchemaFor(BAG, stored), form).map(([path]) => path);
    expect(fields).toEqual(["safeMarginMm"]);
  });

  it("a margin the person typed replaces the kept ones, so the same stored bag passes with 5 → 6", () => {
    expect(refused(printDefaultsSchemaFor(BAG, stored), { ...form, safeMarginMm: 6 })).toEqual([]);
  });
});
