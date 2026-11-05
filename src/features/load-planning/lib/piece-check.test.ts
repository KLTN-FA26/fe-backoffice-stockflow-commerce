import { describe, expect, it } from "vitest";

import { LAYOUT_PICKUP_KIT } from "../__fixtures__/layouts";

import { checkPieces } from "./piece-check";

const PLACED = LAYOUT_PICKUP_KIT.boxes.length; // 23

describe("checkPieces (in = placed + unplaced + fill left)", () => {
  it("balances when every piece is accounted for", () => {
    const check = checkPieces({
      inputLines: [{ quantity: 20 }, { quantity: 6 }],
      layouts: [LAYOUT_PICKUP_KIT],
      unplacedLines: [{ quantity: 3 }],
    });
    expect(check).toMatchObject({
      input: 26,
      placed: PLACED,
      unplaced: 3,
      fillLeft: 0,
      accounted: 26,
      difference: 0,
      ok: true,
    });
  });

  it("counts fill lines on both sides", () => {
    const check = checkPieces({
      inputLines: [{ quantity: 23 }],
      fillLines: [{ quantity: 10 }],
      layouts: [LAYOUT_PICKUP_KIT],
      unplacedLines: [],
      fillLeftLines: [{ quantity: 10 }],
    });
    expect(check).toMatchObject({ input: 33, fillLeft: 10, ok: true });
  });

  it("reports a shortfall: a 4-piece loss must not look like 1", () => {
    const check = checkPieces({
      inputLines: [{ quantity: 27 }],
      layouts: [LAYOUT_PICKUP_KIT],
      unplacedLines: [{ quantity: 0 }],
    });
    expect(check.difference).toBe(-4);
    expect(check.ok).toBe(false);
  });

  it("reports pieces that appear from nowhere", () => {
    const check = checkPieces({
      inputLines: [{ quantity: 20 }],
      layouts: [LAYOUT_PICKUP_KIT],
      unplacedLines: [],
    });
    expect(check.difference).toBe(3);
    expect(check.ok).toBe(false);
  });

  it.each([Number.NaN, -1, 1.5, Number.POSITIVE_INFINITY])(
    "never treats the malformed quantity %s as 0 — it fails the check",
    (quantity) => {
      const check = checkPieces({
        inputLines: [{ quantity: PLACED }],
        layouts: [LAYOUT_PICKUP_KIT],
        unplacedLines: [{ quantity }],
      });
      expect(check.malformedLines).toBe(1);
      expect(check.ok).toBe(false);
    },
  );

  it("sums placed pieces over all vehicles", () => {
    const check = checkPieces({
      inputLines: [{ quantity: PLACED * 2 }],
      layouts: [LAYOUT_PICKUP_KIT, { ...LAYOUT_PICKUP_KIT, seq: 2 }],
      unplacedLines: [],
    });
    expect(check.placed).toBe(PLACED * 2);
    expect(check.ok).toBe(true);
  });
});
