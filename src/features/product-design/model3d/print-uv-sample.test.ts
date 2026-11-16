// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { Vector3, type BufferGeometry, type Mesh } from "three";
import { beforeAll, describe, expect, it } from "vitest";

import { findPrintObjects } from "./find-print-meshes";
import { loadGlb } from "./load";
import { printGeometry } from "./print-uv";
import { uvToSurfacePoint } from "./test-support/cup-body-geometry";
import { cup12oz, cupBody } from "./test-support/fixtures";

import type { CupModel } from "./model-types";

const SAMPLE = path.resolve(process.cwd(), "public/mock/models/sample-cup-12oz.glb");

const cupModel = cup12oz.model as CupModel;

/** 12 oz cup, typed here: top 90, bottom 60, height 110, band offsets 6 and 8, seam 8, bleed 2. */
const SLANT_MM = 111.01801; // sqrt(110^2 + 15^2)
const BAND_TOP_V = 6;
const BAND_BOTTOM_V = 103.01801; // slant - 8
/** α = 2π spans the top circumference scaled to the mid radius: 2π · 45 · (1 − 15 / 90) = 75π. */
const PRINTED_WIDTH_MM = 235.61945;
const TOLERANCE = 1e-6;
/** One UV step of the 280 mm sheet is 3.6e-3 mm; a 1e-3 mm slack in u absorbs the float32 of positions. */
const U_SLACK_MM = 1e-3;

function sampleBytes(): ArrayBuffer {
  const file = readFileSync(SAMPLE);
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
}

let body: Mesh;
let printed: BufferGeometry;

beforeAll(async () => {
  const root = await loadGlb(sampleBytes());
  const found = findPrintObjects(root).find((object) => object.printAreaCode === "BODY");
  if (!found?.mesh) throw new Error("The sample has no print:BODY mesh");
  body = found.mesh;
  printed = printGeometry(body, { code: "BODY", surface: cupBody }, cupModel);
});

describe("printGeometry on the print:BODY mesh of the sample cup (numbers typed here)", () => {
  it("gives the surface the sample was designed for: band from v 6 to 103.018", () => {
    const [top, bottom] = cupBody.vRange;
    expect(Math.abs(top - BAND_TOP_V)).toBeLessThan(1e-3);
    expect(Math.abs(bottom - BAND_BOTTOM_V)).toBeLessThan(1e-3);
    expect(printed.getAttribute("position").count).toBeGreaterThan(0);
  });

  it("keeps every UV inside the unit square", () => {
    const uv = printed.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      for (const value of [uv.getX(i), uv.getY(i)]) {
        expect(value).toBeGreaterThanOrEqual(-TOLERANCE);
        expect(value).toBeLessThanOrEqual(1 + TOLERANCE);
      }
    }
  });

  it("maps nothing beyond the printed width (the glue flap is not on the model)", () => {
    const uv = printed.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      const { u } = uvToSurfacePoint(cupBody, [uv.getX(i), uv.getY(i)]);
      expect(u).toBeGreaterThanOrEqual(-U_SLACK_MM);
      expect(u).toBeLessThanOrEqual(PRINTED_WIDTH_MM + U_SLACK_MM);
    }
  });

  it("winds every triangle away from the Y axis", () => {
    const p = printed.getAttribute("position");
    let checked = 0;
    for (let k = 0; k < p.count; k += 3) {
      const at = (i: number) => new Vector3(p.getX(k + i), p.getY(k + i), p.getZ(k + i));
      const [a, b, c] = [at(0), at(1), at(2)];
      const winding = b.clone().sub(a).cross(c.clone().sub(a));
      if (winding.length() / 2 < 1e-6) continue;
      const centre = new Vector3(a.x + b.x + c.x, 0, a.z + b.z + c.z);
      expect(winding.dot(centre)).toBeGreaterThan(0);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("puts the front centre of the band (+Z, half way up the band) at u = printed width / 2", () => {
    const p = printed.getAttribute("position");
    const uv = printed.getAttribute("uv");
    // half way down the band, in height: v = (6 + 103.018) / 2 on a 110 mm cup of slant 111.018
    const vMid = (BAND_TOP_V + BAND_BOTTOM_V) / 2;
    const yMid = 110 * (1 - vMid / SLANT_MM);
    let nearest = -1;
    let gap = Infinity;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getX(i)) > 1e-3 || p.getZ(i) <= 0) continue;
      if (Math.abs(p.getY(i) - yMid) < gap) {
        gap = Math.abs(p.getY(i) - yMid);
        nearest = i;
      }
    }
    expect(nearest).toBeGreaterThanOrEqual(0);
    // the sample has a ring of vertices at the front; the nearest one is within one band step of the middle
    expect(gap).toBeLessThan(5);

    const v = SLANT_MM * (1 - p.getY(nearest) / 110);
    const flat = cupBody.toFlat(PRINTED_WIDTH_MM / 2, v);
    const [expectedU, expectedV] = cupBody.uvOf(flat.x, flat.y);
    expect(Math.abs(uv.getX(nearest) - expectedU)).toBeLessThan(TOLERANCE);
    expect(Math.abs(uv.getY(nearest) - expectedV)).toBeLessThan(TOLERANCE);
  });
});
