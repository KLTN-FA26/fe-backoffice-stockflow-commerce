import { describe, expect, it } from "vitest";

import { gridBlock, makeLayout } from "../__fixtures__/build";
import { LAYOUT_40HC, LAYOUT_PICKUP_KIT } from "../__fixtures__/layouts";

import { buildLoadingSteps } from "./loading-steps";

import type { CartonType } from "../__fixtures__/build";
import type { Layout } from "../types";

/** Bước xếp phải có chỗ tựa: mỗi kiện chỉ được xếp sau (hoặc cùng bước với) kiện nó đứng lên. */

/** Số kiện có chỗ tựa nằm ở bước SAU nó (kiện "treo" lúc xếp). */
function hangingBoxes(layout: Layout, steps: ReturnType<typeof buildLoadingSteps>): number {
  const stepOf = new Map(steps.flatMap((s) => s.boxes.map((b) => [b, s.seq] as const)));
  let hanging = 0;
  for (const upper of layout.boxes) {
    if (upper.yMm < 3) continue;
    for (const lower of layout.boxes) {
      const touches =
        lower !== upper &&
        Math.abs(lower.yMm + lower.hMm - upper.yMm) < 3 &&
        Math.min(upper.xMm + upper.wMm, lower.xMm + lower.wMm) - Math.max(upper.xMm, lower.xMm) >
          3 &&
        Math.min(upper.zMm + upper.dMm, lower.zMm + lower.dMm) - Math.max(upper.zMm, lower.zMm) > 3;
      if (touches && (stepOf.get(lower) ?? 0) > (stepOf.get(upper) ?? 0)) hanging += 1;
    }
  }
  return hanging;
}

const CUBE: CartonType = {
  ref: "R",
  label: "X",
  partName: "X",
  origMm: { l: 1000, w: 1000, h: 1000 },
  weightKg: 1,
};
const cubeAt = (partName: string, xMm: number, yMm: number) =>
  gridBlock({
    carton: { ...CUBE, ref: partName, label: partName, partName },
    origin: { xMm, yMm, zMm: 0 },
    counts: { nx: 1, ny: 1, nz: 1 },
  });
const bigLayout = (boxes: Layout["boxes"]) =>
  makeLayout({
    seq: 1,
    code: "X",
    innerMm: { l: 3000, w: 3000, h: 4000 },
    maxPayloadKg: 100,
    boxes,
  });

describe("buildLoadingSteps support ordering", () => {
  it("has no hanging boxes in the realistic fixtures", () => {
    for (const layout of [LAYOUT_40HC, LAYOUT_PICKUP_KIT]) {
      expect(hangingBoxes(layout, buildLoadingSteps([layout]))).toBe(0);
    }
  });

  it("loads the other item first when a box inside a merged block rests half on it", () => {
    // A (X) x0-1000 và C (Y) x1000-2000 nằm sàn; B (X) x500-1500 tựa nửa lên A, nửa lên C.
    // {A, B} gộp một khối vì cùng mặt hàng; hộp bao của khối có A nằm sàn nên gốc coi là "sẵn sàng"
    // và xếp B lơ lửng trước C.
    const layout = bigLayout([
      ...cubeAt("X", 0, 0),
      ...cubeAt("Y", 1000, 0),
      ...cubeAt("X", 500, 1000),
    ]);
    const steps = buildLoadingSteps([layout]);
    expect(steps.map((s) => [s.partName, s.count])).toEqual([
      ["Y", 1],
      ["X", 2],
    ]);
    expect(hangingBoxes(layout, steps)).toBe(0);
  });

  it("splits a merged block when two blocks hold each other up (interlocking stacks)", () => {
    // Khối X = {A, D, E, B} (liền nhau); C (Y) tựa lên A, còn B (X) tựa lên C và E:
    // khối X cần C, C cần khối X → phải tách X theo tầng.
    const layout = bigLayout([
      ...cubeAt("X", 0, 0), // A
      ...cubeAt("X", 1000, 0), // D
      ...cubeAt("X", 1000, 1000), // E
      ...cubeAt("Y", 0, 1000), // C
      ...cubeAt("X", 500, 2000), // B
    ]);
    const steps = buildLoadingSteps([layout]);
    expect(steps.reduce((n, s) => n + s.count, 0)).toBe(5);
    expect(steps.map((s) => `${s.partName}${s.count}`)).toEqual(["X2", "Y1", "X1", "X1"]);
    expect(hangingBoxes(layout, steps)).toBe(0);
  });
});
