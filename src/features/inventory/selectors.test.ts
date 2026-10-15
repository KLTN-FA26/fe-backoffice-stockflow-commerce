import { describe, expect, it } from "vitest";

import { STOCK_MOVEMENT_LABELS, STOCK_MOVEMENT_TYPES } from "@/constants/inventory";

import { inventoryPageRange, movementTypeLabel } from "./selectors";

describe("inventory pagination metadata", () => {
  it("uses backend total and zero-based page", () => {
    expect(
      inventoryPageRange({ items: Array(15).fill(null), page: 2, size: 15, totalElements: 50 }),
    ).toEqual({ first: 31, last: 45, total: 50 });
  });

  it("handles a partial final page", () => {
    expect(
      inventoryPageRange({ items: Array(5).fill(null), page: 3, size: 15, totalElements: 50 }),
    ).toEqual({ first: 46, last: 50, total: 50 });
  });

  it("does not show an inverted range when the page is empty", () => {
    expect(inventoryPageRange({ items: [], page: 4, size: 15, totalElements: 50 })).toEqual({
      first: 0,
      last: 0,
      total: 50,
    });
  });
});

describe("movement type label", () => {
  it.each(STOCK_MOVEMENT_TYPES)("localizes known %s", (type) => {
    expect(movementTypeLabel(type)).toBe(STOCK_MOVEMENT_LABELS[type]);
    expect(movementTypeLabel(type)).not.toBe(type);
  });

  it.each(["FUTURE_MOVEMENT_TYPE", "constructor"])("shows unknown %s verbatim", (type) => {
    expect(movementTypeLabel(type)).toBe(type);
  });
});
