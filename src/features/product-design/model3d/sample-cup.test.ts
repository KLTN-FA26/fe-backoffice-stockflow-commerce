// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { templateDifferences } from "./compare-template";
import { bandVRangeOf } from "./cup-sector";
import { loadGlb } from "./load";
import { measureModel } from "./measure";
import { customizationTemplateSchema } from "./model-types";
import { templateFromModel } from "./template-from-model";

const SAMPLE = path.resolve(process.cwd(), "public/mock/models/sample-cup-12oz.glb");

/** The sample file's bytes as an ArrayBuffer of its own (the test realm's, not Node's Buffer pool). */
function sampleBytes(): ArrayBuffer {
  const file = readFileSync(SAMPLE);
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
}

async function measureSample() {
  const bytes = sampleBytes();
  const root = await loadGlb(bytes);
  return measureModel(root, { byteLength: bytes.byteLength });
}

const near = (actual: number, wanted: number, within: number) =>
  expect(Math.abs(actual - wanted)).toBeLessThan(within);

describe("the real sample cup, loaded from its bytes (all numbers typed here)", () => {
  it("is the 113,376 byte file the storefront ships", () => {
    expect(sampleBytes().byteLength).toBe(113_376);
  });

  it("measures as a 90 / 60 / 110 cup with band offsets 6 and 8, no error and no warning", async () => {
    const measured = await measureSample();
    expect(measured.kind).toBe("cup");
    expect(measured.issues).toEqual([]);
    const { model } = measured;
    if (!model || model.kind !== "parametric-cup") throw new Error("expected a cup model");
    near(model.topDiameterMm, 90, 0.02);
    near(model.bottomDiameterMm, 60, 0.02);
    near(model.heightMm, 110, 0.02);
    near(model.bandTopOffsetMm, 6, 0.02);
    near(model.bandBottomOffsetMm, 8, 0.02);
    expect(model.seamMm).toBe(8);
  });

  it("gives the sector 230.04 / 327.05 / 0.84894 rad and the box 279.67 x 120.85, and parses", async () => {
    const measured = await measureSample();
    if (!measured.model) throw new Error("expected a model");
    const template = templateFromModel({ ...measured.model }, measured.printMeshes);
    expect(customizationTemplateSchema.safeParse(template).success).toBe(true);
    const [area] = template.printAreas;
    if (!area || area.shape.type !== "annular-sector") throw new Error("expected a sector area");
    near(area.shape.innerRadiusMm, 230.04, 0.05);
    near(area.shape.outerRadiusMm, 327.05, 0.05);
    near(area.shape.sweepRad, 0.84894, 0.001);
    expect(area.shape.seamMm).toBe(8);
    near(area.widthMm, 279.67, 0.05);
    near(area.heightMm, 120.85, 0.05);
  });

  it("has no difference between its print mesh and the template made from it", async () => {
    const measured = await measureSample();
    if (!measured.model) throw new Error("expected a model");
    const [part] = measured.printMeshes;
    if (!part) throw new Error("expected a print mesh");
    expect(part.printAreaCode).toBe("BODY");
    // v of the band's top and bottom edge for the 90 / 60 / 110 cup: 6 and the 111.018 mm slant minus 8
    const vRange = [6, 103.018] as const;
    expect(
      templateDifferences(
        { code: part.printAreaCode, surface: { vRange }, shape: part.shape },
        measured.model,
      ),
    ).toEqual([]);
    // `bandVRangeOf` gives the same pair as the typed one
    if (measured.model.kind !== "parametric-cup") throw new Error("expected a cup model");
    const [top, bottom] = bandVRangeOf(measured.model);
    near(top, 6, 0.02);
    near(bottom, 103.018, 0.02);
  });
});
