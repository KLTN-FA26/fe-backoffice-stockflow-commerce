import { describe, expect, it } from "vitest";

import { LOAD_PLANNING_LIMITS } from "@/constants";

import { LAYOUT_PICKUP_KIT } from "../__fixtures__/layouts";

import {
  computeEmptySpaces,
  computeLandingGhosts,
  fittingOrientations,
  orientationsOf,
} from "./empty-spaces";
import { extentOf } from "./dims";
import { validatePlacement } from "./manual-packing";

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
const volume = (s: BlockMm) => s.wMm * s.hMm * s.dMm;

describe("orientationsOf", () => {
  it("offers only the unrotated pose when the item may not rotate", () => {
    expect(orientationsOf({ l: 1, w: 2, h: 3 }, false)).toEqual([
      { orientation: "LWH", dMm: 1, wMm: 2, hMm: 3 },
    ]);
  });

  it("offers six poses for a box with three different sides", () => {
    const list = orientationsOf({ l: 1, w: 2, h: 3 }, true);
    expect(list).toHaveLength(6);
    expect(new Set(list.map((o) => o.orientation)).size).toBe(6);
  });

  it("collapses poses that give the same extent (cube → 1, square footprint → 3)", () => {
    expect(orientationsOf({ l: 5, w: 5, h: 5 }, true)).toHaveLength(1);
    expect(orientationsOf({ l: 5, w: 5, h: 9 }, true)).toHaveLength(3);
  });
});

describe("computeEmptySpaces", () => {
  it("an empty vehicle is one big space", () => {
    const spaces = computeEmptySpaces(EXTENT, []);
    expect(spaces).toHaveLength(1);
    expect(spaces[0]).toMatchObject({ xMm: 0, yMm: 0, zMm: 0, wMm: 1000, hMm: 1000, dMm: 1000 });
  });

  it("a box in the corner leaves exactly three maximal spaces (beside, above, in front)", () => {
    const spaces = computeEmptySpaces(EXTENT, [block(0, 0, 0, 100, 100, 100)]);
    expect(spaces).toHaveLength(3);
    expect(spaces.map(volume).sort((a, b) => a - b)).toEqual([
      900_000_000, 900_000_000, 900_000_000,
    ]);
  });

  it("drops slivers thinner than the minimum (a 20 mm gap cannot hold a carton)", () => {
    const spaces = computeEmptySpaces(EXTENT, [block(0, 0, 0, 980, 1000, 1000)]);
    expect(spaces).toHaveLength(0);
    expect(LOAD_PLANNING_LIMITS.minEmptySpaceMm).toBe(50);
  });

  it("a full vehicle has no space left", () => {
    expect(computeEmptySpaces(EXTENT, [block(0, 0, 0, 1000, 1000, 1000)])).toEqual([]);
  });

  it("never reports a space that overlaps a placed box", () => {
    const placed = [
      block(0, 0, 0, 400, 300, 400),
      block(400, 0, 0, 300, 600, 300),
      block(0, 300, 0, 400, 200, 400),
    ];
    const spaces = computeEmptySpaces(EXTENT, placed);
    for (const space of spaces) {
      for (const p of placed) {
        const overlap =
          space.xMm < p.xMm + p.wMm - 0.5 &&
          space.xMm + space.wMm > p.xMm + 0.5 &&
          space.yMm < p.yMm + p.hMm - 0.5 &&
          space.yMm + space.hMm > p.yMm + 0.5 &&
          space.zMm < p.zMm + p.dMm - 0.5 &&
          space.zMm + space.dMm > p.zMm + 0.5;
        expect(overlap).toBe(false);
      }
    }
  });

  it("gives every space a unique id", () => {
    const spaces = computeEmptySpaces(EXTENT, [
      block(0, 0, 0, 100, 100, 100),
      block(500, 0, 500, 100, 100, 100),
    ]);
    expect(new Set(spaces.map((s) => s.id)).size).toBe(spaces.length);
  });

  it("copes with the fixture pickup (23 boxes) quickly", () => {
    const spaces = computeEmptySpaces(extentOf(LAYOUT_PICKUP_KIT.innerMm), LAYOUT_PICKUP_KIT.boxes);
    expect(spaces.length).toBeGreaterThan(0);
    expect(spaces.length).toBeLessThanOrEqual(LOAD_PLANNING_LIMITS.emptySpacesMax);
  });
});

describe("fittingOrientations", () => {
  it("keeps only poses that fit and puts the lowest first", () => {
    const space = block(0, 0, 0, 1000, 400, 1000);
    const list = fittingOrientations(space, { l: 900, w: 300, h: 500 }, true);
    // cao 500 > 400 bị loại; còn cao 300 (2 hướng), cao 900 bị loại
    expect(list.every((o) => o.hMm <= 400)).toBe(true);
    expect(list[0].hMm).toBe(300);
  });

  it("returns nothing when no pose fits", () => {
    expect(
      fittingOrientations(block(0, 0, 0, 100, 100, 100), { l: 200, w: 200, h: 200 }, true),
    ).toEqual([]);
  });
});

describe("computeLandingGhosts", () => {
  const carton = { origMm: { l: 300, w: 300, h: 300 }, rotatable: false };

  it("offers the floor next to a box and every ghost passes the placement rules", () => {
    const placed = [block(0, 0, 0, 100, 100, 100)];
    const ghosts = computeLandingGhosts(EXTENT, placed, carton);
    expect(ghosts.length).toBeGreaterThan(0);
    for (const g of ghosts) {
      expect(validatePlacement(g, EXTENT, placed).ok).toBe(true);
      expect(g.supportRatio).toBeGreaterThanOrEqual(LOAD_PLANNING_LIMITS.minSupportRatio);
    }
  });

  it("does NOT offer a spot on top of a box too small to support the carton (support is an error)", () => {
    const placed = [block(0, 0, 0, 100, 100, 100)];
    const ghosts = computeLandingGhosts(EXTENT, placed, carton);
    // trên tấm 100×100 thì thùng 300×300 chỉ được đỡ ~11% → bị loại
    expect(ghosts.some((g) => g.yMm > 0)).toBe(false);
  });

  it("offers a spot on top of a box that does support it, resting on that box (gravity)", () => {
    const placed = [block(0, 0, 0, 400, 100, 400)];
    const ghosts = computeLandingGhosts(EXTENT, placed, carton);
    expect(ghosts.some((g) => g.yMm === 100 && g.xMm === 0 && g.zMm === 0)).toBe(true);
  });

  it("lists low landings first and de-duplicates", () => {
    const ghosts = computeLandingGhosts(EXTENT, [block(0, 0, 0, 400, 100, 400)], carton);
    const ys = ghosts.map((g) => g.yMm);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(new Set(ghosts.map((g) => g.id)).size).toBe(ghosts.length);
  });

  it("returns nothing when the carton fits nowhere", () => {
    expect(
      computeLandingGhosts(EXTENT, [], { origMm: { l: 2000, w: 2000, h: 2000 }, rotatable: true }),
    ).toEqual([]);
  });

  it("caps the number of ghosts", () => {
    const small = { origMm: { l: 50, w: 50, h: 50 }, rotatable: false };
    const ghosts = computeLandingGhosts(
      { wMm: 100000, hMm: 100000, dMm: 100000 },
      Array.from({ length: 40 }, (_, i) => block(i * 100, 0, 0, 90, 90, 90)),
      small,
    );
    expect(ghosts.length).toBeLessThanOrEqual(LOAD_PLANNING_LIMITS.landingGhostsMax);
  });
});

describe("computeLandingGhosts options (PR F5)", () => {
  const BOX_ORIG = { l: 400, w: 300, h: 200 };
  const placed = [block(0, 0, 0, 100, 100, 100)];

  it("uses precomputed spaces (from the worker) and gives the same ghosts as computing inline", () => {
    const box = { origMm: BOX_ORIG, rotatable: true };
    const spaces = computeEmptySpaces(EXTENT, placed);
    expect(computeLandingGhosts(EXTENT, placed, box, { spaces })).toEqual(
      computeLandingGhosts(EXTENT, placed, box),
    );
  });

  it("with an orientation, only that pose is offered and ghosts carry its code and extents", () => {
    const box = { origMm: BOX_ORIG, rotatable: true };
    const ghosts = computeLandingGhosts(EXTENT, placed, box, { orientation: "WLH" });
    expect(ghosts.length).toBeGreaterThan(0);
    for (const g of ghosts) {
      // WLH reads (z, x, y) = (W, L, H) → z 300, x 400, y 200
      expect(g.orientation).toBe("WLH");
      expect([g.dMm, g.wMm, g.hMm]).toEqual([300, 400, 200]);
    }
  });

  it("a parcel that may not rotate has no ghost for any pose but LWH", () => {
    const fixed = { origMm: BOX_ORIG, rotatable: false };
    expect(computeLandingGhosts(EXTENT, placed, fixed, { orientation: "WLH" })).toEqual([]);
    expect(
      computeLandingGhosts(EXTENT, placed, fixed, { orientation: "LWH" }).length,
    ).toBeGreaterThan(0);
  });

  it("the door removes poses whose door-facing side is too big and falls back to one that passes", () => {
    const box = { origMm: BOX_ORIG, rotatable: true };
    // door 250 wide x 450 tall: only poses with width <= 250 and height <= 450 pass
    const door = { widthMm: 250, heightMm: 450 };
    const ghosts = computeLandingGhosts(EXTENT, placed, box, { door });
    expect(ghosts.length).toBeGreaterThan(0);
    for (const g of ghosts) {
      expect(g.wMm).toBeLessThanOrEqual(250);
      expect(g.hMm).toBeLessThanOrEqual(450);
    }
    // a door nothing fits through
    expect(
      computeLandingGhosts(EXTENT, placed, box, { door: { widthMm: 100, heightMm: 100 } }),
    ).toEqual([]);
    // an explicitly requested pose that does not pass the door is refused too
    expect(computeLandingGhosts(EXTENT, placed, box, { door, orientation: "LWH" })).toEqual([]);
  });
});
