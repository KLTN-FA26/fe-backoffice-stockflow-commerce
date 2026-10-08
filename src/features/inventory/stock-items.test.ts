import { describe, expect, it } from "vitest";

import { createStockItemsFixture } from "./fixtures";
import { orderStockItemsByExpiry } from "./stock-items";

describe("stock-item FEFO presentation", () => {
  it("shows earlier expiry first and missing expiry last without mutating the source", () => {
    const source = [...createStockItemsFixture()].reverse();
    const ordered = orderStockItemsByExpiry(source);
    expect(ordered.map((row) => row.id)).toEqual(["demo-item-1", "demo-item-2", "demo-item-3"]);
    expect(source[0].id).toBe("demo-item-3");
  });
});
