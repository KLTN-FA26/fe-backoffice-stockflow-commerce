/**
 * The form's schema against BE `PrintConfigRules` (origin/develop 3672ffb7): each value's own limits, and, with the
 * model in play, the rules that need its sizes, each on the field the BE names.
 */
import { describe, expect, it } from "vitest";

import { BAG_BODY, CUP } from "../test-fixtures";
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
