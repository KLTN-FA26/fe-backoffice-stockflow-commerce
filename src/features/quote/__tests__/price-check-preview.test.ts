/** Xem trước luật duyệt giá trên form báo giá — cùng cách BE `QuotePriceCheck.of` tính (14 BR-10). */
import { describe, expect, it } from "vitest";

import { checkTierPrice, linePriceVerdict } from "../selectors";

const OWN = [
  { minQuantity: 20, unitPrice: 1250 },
  { minQuantity: 50, unitPrice: 1150 },
];
const STANDARD = [{ minQuantity: 10, unitPrice: 1400 }];

describe("checkTierPrice", () => {
  it("reads the reference at the tier's own start, from the customer's price first", () => {
    expect(
      checkTierPrice({ minQuantity: 60, unitPrice: 1150 }, { own: OWN, standard: undefined }, 10),
    ).toEqual({
      kind: "ok",
      referencePrice: 1150,
      source: "CUSTOMER_PRICE",
      discountPercent: 0,
    });
  });

  it("needs approval only when MORE than the threshold below (exactly 10% passes)", () => {
    const refs = { own: OWN, standard: undefined };
    expect(checkTierPrice({ minQuantity: 20, unitPrice: 1125 }, refs, 10).kind).toBe("ok");
    const over = checkTierPrice({ minQuantity: 20, unitPrice: 1124 }, refs, 10);
    expect(over.kind).toBe("over");
    expect(over.kind === "over" && over.discountPercent).toBe(10.08);
  });

  it("a price above the reference always passes, with a negative discount", () => {
    const verdict = checkTierPrice(
      { minQuantity: 20, unitPrice: 1500 },
      { own: OWN, standard: undefined },
      10,
    );
    expect(verdict).toMatchObject({ kind: "ok", discountPercent: -20 });
  });

  it("no customer price → the standard price; neither → no reference (needs approval)", () => {
    expect(
      checkTierPrice({ minQuantity: 20, unitPrice: 1400 }, { own: null, standard: STANDARD }, 10),
    ).toMatchObject({
      kind: "ok",
      source: "STANDARD_PRICE",
    });
    expect(
      checkTierPrice({ minQuantity: 5, unitPrice: 1400 }, { own: null, standard: STANDARD }, 10)
        .kind,
    ).toBe("noReference");
    expect(
      checkTierPrice({ minQuantity: 20, unitPrice: 1 }, { own: null, standard: null }, 10).kind,
    ).toBe("noReference");
  });

  it("says nothing it cannot know: references still loading, or the standard price not read", () => {
    expect(
      checkTierPrice({ minQuantity: 20, unitPrice: 1 }, { own: undefined, standard: undefined }, 10)
        .kind,
    ).toBe("unknown");
    // Below the customer's first break the BE falls back to the standard price, which the form did not ask for.
    expect(
      checkTierPrice({ minQuantity: 5, unitPrice: 1 }, { own: OWN, standard: undefined }, 10).kind,
    ).toBe("unknown");
  });
});

describe("linePriceVerdict", () => {
  it("empty tiers take the reference price (BE fills them in): ok when there is one, no price when none", () => {
    expect(linePriceVerdict([], { own: OWN, standard: undefined }, 10)).toBe("ok");
    expect(linePriceVerdict([], { own: null, standard: STANDARD }, 10)).toBe("ok");
    expect(linePriceVerdict([], { own: null, standard: null }, 10)).toBe("noPrice");
    expect(linePriceVerdict([], { own: null, standard: undefined }, 10)).toBe("unknown");
  });

  it("one tier needing approval makes the line need it", () => {
    const tiers = [
      { minQuantity: 20, unitPrice: 1250 },
      { minQuantity: 50, unitPrice: 900 },
    ];
    expect(linePriceVerdict(tiers, { own: OWN, standard: undefined }, 10)).toBe("needsApproval");
    expect(linePriceVerdict(tiers.slice(0, 1), { own: OWN, standard: undefined }, 10)).toBe("ok");
  });
});
