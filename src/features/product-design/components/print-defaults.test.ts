import { describe, expect, it } from "vitest";

import { cupDto } from "../test-fixtures";
import { defaultsFor, gussetOf, printDefaultsSchemaFor } from "./print-defaults";

import type { BagModel } from "../model3d/model-types";
import type { PrintConfigDto } from "../types";

/** A bag saved before the flat sheet: no glue flap, no bottom fold. */
const BAG: BagModel = {
  kind: "parametric-bag",
  widthMm: 240,
  gussetMm: 110,
  heightMm: 310,
  topFoldMm: 30,
  handle: "twisted",
  material: "kraft-brown",
};
const measured = (gussetMm: number): BagModel => ({ ...BAG, gussetMm });
const storedBag = (model: BagModel): PrintConfigDto =>
  cupDto({
    model,
    printAreas: (["FRONT", "BACK", "LEFT", "RIGHT"] as const).map((code) => ({
      code,
      name: code,
      xMm: 0,
      yMm: 0,
      widthMm: code === "FRONT" || code === "BACK" ? model.widthMm : model.gussetMm,
      heightMm: model.heightMm - model.topFoldMm,
      safeMarginMm: 5,
      bleedMm: 3,
      shape: { type: "rect" },
      uvMapping: { meshPart: `print:${code}` },
    })),
  });

describe("defaultsFor — glue flap and bottom fold (BE BagModel.withDefaults)", () => {
  it("a new bag pre-fills 20 mm and round2(0.6 × the file's gusset)", () => {
    const d = defaultsFor("parametric-bag", null, measured(120));
    expect(d.glueFlapMm).toBe(20);
    expect(d.bottomFoldMm).toBe(72);
  });

  it("a stored bag keeps its own glue flap and bottom fold", () => {
    const d = defaultsFor(
      "parametric-bag",
      storedBag({ ...BAG, glueFlapMm: 15, bottomFoldMm: 50 }),
      measured(120),
    );
    expect(d).toMatchObject({ glueFlapMm: 15, bottomFoldMm: 50 });
  });

  it("a bag stored before them shows the defaults, from its stored gusset", () => {
    const d = defaultsFor("parametric-bag", storedBag(BAG));
    expect(d).toMatchObject({ glueFlapMm: 20, bottomFoldMm: 66 });
  });

  it("a cup has the bag fields at values its schema accepts", () => {
    const d = defaultsFor("parametric-cup", null);
    expect(printDefaultsSchemaFor(null).safeParse(d).success).toBe(true);
  });
});

describe("printDefaultsSchemaFor — BE PrintConfigRules.requireBag", () => {
  const base = defaultsFor("parametric-bag", null, measured(120));
  const issue = (gusset: number | null, patch: Partial<typeof base>) => {
    const parsed = printDefaultsSchemaFor(gusset).safeParse({ ...base, ...patch });
    return parsed.success ? null : parsed.error.issues[0];
  };

  it.each([0, 20, 100])("glue flap %s mm is accepted", (glueFlapMm) => {
    expect(issue(120, { glueFlapMm })).toBeNull();
  });

  it.each([-0.01, 100.01])("glue flap %s mm is refused on its field", (glueFlapMm) => {
    expect(issue(120, { glueFlapMm })?.path).toEqual(["glueFlapMm"]);
  });

  it("bottom fold 0 and equal to the gusset are accepted", () => {
    expect(issue(120, { bottomFoldMm: 0 })).toBeNull();
    expect(issue(120, { bottomFoldMm: 120 })).toBeNull();
  });

  it("a bottom fold deeper than the gusset is refused, naming the gusset", () => {
    const found = issue(120, { bottomFoldMm: 120.01 });
    expect(found?.path).toEqual(["bottomFoldMm"]);
    expect(found?.message).toBe("Không sâu hơn hông túi (120,0 mm).");
  });

  it("a negative bottom fold is refused", () => {
    expect(issue(120, { bottomFoldMm: -1 })?.path).toEqual(["bottomFoldMm"]);
  });

  it("without a gusset (a cup) the gusset rule is left out", () => {
    expect(issue(null, { bottomFoldMm: 500 })).toBeNull();
  });

  it("gussetOf reads a bag's gusset only", () => {
    expect(gussetOf(measured(120))).toBe(120);
    expect(gussetOf(null)).toBeNull();
    expect(gussetOf(cupDto().model)).toBeNull();
  });
});
