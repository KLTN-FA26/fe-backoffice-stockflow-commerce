import { describe, expect, it } from "vitest";

import { LOAD_PLANNING_LIMITS } from "@/constants";

import {
  intersects,
  maxSlide,
  overlapsAny,
  restingY,
  settleFloaters,
  supportRatio,
  validatePlacement,
} from "./manual-packing";

import type { BlockMm } from "../types";

const EXTENT = { wMm: 1000, hMm: 1000, dMm: 1000 };
const block = (
  xMm: number,
  yMm: number,
  zMm: number,
  wMm: number,
  hMm: number,
  dMm: number,
): BlockMm => ({
  xMm,
  yMm,
  zMm,
  wMm,
  hMm,
  dMm,
});
const FLOOR_SLAB = block(0, 0, 0, 100, 100, 100);

describe("overlap", () => {
  it("face contact is not an overlap, an intrusion beyond the tolerance is", () => {
    expect(intersects(block(0, 0, 0, 100, 100, 100), block(100, 0, 0, 100, 100, 100))).toBe(false);
    expect(intersects(block(0, 0, 0, 100, 100, 100), block(99, 0, 0, 100, 100, 100))).toBe(true);
    expect(intersects(block(0, 0, 0, 100, 100, 100), block(99.8, 0, 0, 100, 100, 100))).toBe(false);
  });

  it("overlapsAny scans every other block", () => {
    expect(overlapsAny(block(500, 0, 0, 10, 10, 10), [FLOOR_SLAB])).toBe(false);
    expect(
      overlapsAny(block(50, 50, 50, 10, 10, 10), [block(900, 0, 0, 1, 1, 1), FLOOR_SLAB]),
    ).toBe(true);
  });
});

describe("supportRatio", () => {
  it("is 1 on the floor and 0 with nothing underneath", () => {
    expect(supportRatio(block(0, 0, 0, 100, 100, 100), [])).toBe(1);
    expect(supportRatio(block(0, 100, 0, 100, 100, 100), [])).toBe(0);
  });

  it("counts only the part of the base resting on a top at exactly its height", () => {
    // đáy 100×100 ở y=100, tấm đỡ rộng 100 nhưng chỉ phủ nửa chiều dài z
    expect(
      supportRatio(block(0, 100, 0, 100, 100, 100), [block(0, 0, 0, 100, 100, 50)]),
    ).toBeCloseTo(0.5, 9);
  });

  it("ignores boxes whose top is at a different height", () => {
    expect(supportRatio(block(0, 100, 0, 100, 100, 100), [block(0, 0, 0, 100, 50, 100)])).toBe(0);
  });

  it("adds up several supporters", () => {
    const supports = [block(0, 0, 0, 50, 100, 100), block(50, 0, 0, 50, 100, 100)];
    expect(supportRatio(block(0, 100, 0, 100, 100, 100), supports)).toBeCloseTo(1, 9);
  });
});

describe("validatePlacement — support is a blocking error, not a warning", () => {
  it("accepts a box on the floor", () => {
    expect(validatePlacement(block(0, 0, 0, 200, 200, 200), EXTENT, [])).toEqual({
      violations: [],
      supportRatio: 1,
      ok: true,
    });
  });

  it("flags a floating box as UNSUPPORTED and not ok", () => {
    const check = validatePlacement(block(0, 300, 0, 100, 100, 100), EXTENT, []);
    expect(check.violations).toEqual(["UNSUPPORTED"]);
    expect(check.ok).toBe(false);
  });

  it("requires at least 98% of the base: 98% passes, 97% fails", () => {
    expect(LOAD_PLANNING_LIMITS.minSupportRatio).toBe(0.98);
    const on = (width: number) =>
      validatePlacement(block(0, 100, 0, 100, 100, 100), EXTENT, [block(0, 0, 0, width, 100, 100)]);
    expect(on(98).ok).toBe(true);
    expect(on(97).violations).toEqual(["UNSUPPORTED"]);
  });

  it("flags OUT_OF_BOUNDS for every wall", () => {
    for (const b of [
      block(-5, 0, 0, 100, 100, 100),
      block(950, 0, 0, 100, 100, 100),
      block(0, 950, 0, 100, 100, 100),
      block(0, 0, 950, 100, 100, 100),
      block(0, 0, -5, 100, 100, 100),
    ]) {
      expect(validatePlacement(b, EXTENT, []).violations).toContain("OUT_OF_BOUNDS");
    }
  });

  it("flags OVERLAP and reports every rule that is broken", () => {
    const check = validatePlacement(block(50, 0, 0, 100, 100, 100), EXTENT, [FLOOR_SLAB]);
    expect(check.violations).toEqual(["OVERLAP"]);
    const both = validatePlacement(block(950, 400, 0, 100, 100, 100), EXTENT, []);
    expect(both.violations).toEqual(["OUT_OF_BOUNDS", "UNSUPPORTED"]);
  });

  it("reports a corner gusset as GUSSET, not OVERLAP, when passed as gussets", () => {
    const gusset = block(0, 850, 0, 150, 150, 150);
    const check = validatePlacement(block(0, 800, 0, 100, 100, 100), EXTENT, [], [gusset]);
    expect(check.violations).toEqual(["GUSSET", "UNSUPPORTED"]);
    expect(validatePlacement(block(500, 0, 0, 100, 100, 100), EXTENT, [], [gusset]).ok).toBe(true);
  });

  it("treats a gusset passed as an obstacle like any other block", () => {
    const gusset = block(0, 850, 0, 150, 150, 150);
    expect(
      validatePlacement(block(0, 800, 0, 100, 100, 100), EXTENT, [gusset]).violations,
    ).toContain("OVERLAP");
  });
});

describe("restingY", () => {
  it("drops to the floor when nothing is underneath", () => {
    expect(restingY({ xMm: 500, zMm: 500, wMm: 100, dMm: 100 }, 800, [FLOOR_SLAB])).toBe(0);
  });

  it("lands on the highest top under the footprint that is below the ceiling", () => {
    const stack = [
      block(0, 0, 0, 100, 100, 100),
      block(0, 100, 0, 100, 150, 100),
      block(0, 250, 0, 100, 100, 100),
    ];
    expect(restingY({ xMm: 0, zMm: 0, wMm: 100, dMm: 100 }, 260, stack)).toBe(250);
    expect(restingY({ xMm: 0, zMm: 0, wMm: 100, dMm: 100 }, 250, stack)).toBe(250);
    expect(restingY({ xMm: 0, zMm: 0, wMm: 100, dMm: 100 }, 240, stack)).toBe(100);
  });
});

describe("settleFloaters", () => {
  it("drops a floating box onto the box below and leaves supported boxes alone", () => {
    const list = [block(0, 500, 0, 100, 100, 100), FLOOR_SLAB, block(300, 0, 0, 100, 100, 100)];
    const settled = settleFloaters(list);
    expect(settled.map((b) => b.yMm)).toEqual([100, 0, 0]);
    expect(list[0].yMm).toBe(500); // không sửa mảng gốc
  });

  it("settles low to high so a column of floaters stacks up from the floor", () => {
    const settled = settleFloaters([
      block(0, 900, 0, 100, 100, 100),
      block(0, 600, 0, 100, 100, 100),
    ]);
    expect(settled.map((b) => b.yMm)).toEqual([100, 0]);
  });

  it("rests on obstacles such as gussets", () => {
    const gusset = block(0, 400, 0, 150, 150, 150);
    expect(settleFloaters([block(0, 700, 0, 100, 100, 100)], [gusset])[0].yMm).toBe(550);
  });

  it("keeps the extra fields of a richer type", () => {
    const [out] = settleFloaters([{ ...FLOOR_SLAB, ref: "A" }]);
    expect(out.ref).toBe("A");
  });
});

describe("maxSlide", () => {
  const box = block(100, 0, 100, 100, 100, 100);

  it("slides to the wall", () => {
    expect(maxSlide(box, "x", -1, EXTENT, [])).toBe(100);
    expect(maxSlide(box, "x", 1, EXTENT, [])).toBe(800);
    expect(maxSlide(box, "z", 1, EXTENT, [])).toBe(800);
    expect(maxSlide(box, "y", 1, EXTENT, [])).toBe(900);
    expect(maxSlide(box, "y", -1, EXTENT, [])).toBe(0);
  });

  it("stops flush against a neighbour in the way", () => {
    expect(maxSlide(box, "x", 1, EXTENT, [block(500, 0, 100, 100, 100, 100)])).toBe(300);
    expect(maxSlide(box, "x", -1, EXTENT, [block(0, 0, 100, 50, 100, 100)])).toBe(50);
  });

  it("is not blocked by a box that is off to the side of the slide path", () => {
    expect(maxSlide(box, "x", 1, EXTENT, [block(500, 0, 600, 100, 100, 100)])).toBe(800);
    expect(maxSlide(box, "x", 1, EXTENT, [block(500, 300, 100, 100, 100, 100)])).toBe(800);
  });

  it("returns 0 when already touching", () => {
    expect(maxSlide(box, "x", 1, EXTENT, [block(200, 0, 100, 100, 100, 100)])).toBe(0);
  });
});
