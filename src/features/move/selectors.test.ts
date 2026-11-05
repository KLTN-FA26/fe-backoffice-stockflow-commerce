import { describe, expect, it } from "vitest";

import {
  destinationCodes,
  findSourceRow,
  isCountHidden,
  movableQuantity,
  normalizeLocation,
  sameLocation,
  sameWarehouse,
  warehouseOf,
} from "./selectors";

import type { StockRow, WarehouseLayout } from "./types";

const row = (overrides: Partial<StockRow>): StockRow => ({
  id: crypto.randomUUID(),
  sku: "CUP-PP-500",
  locationCode: "HCM-A01-1-A",
  onHand: 10,
  reserved: 4,
  available: 6,
  hiddenDuringCount: false,
  status: "AVAILABLE",
  ...overrides,
});

describe("location helpers (BE LocationId)", () => {
  it("normalises like the BE: trim + upper case", () => {
    expect(normalizeLocation("  hcm-a01-1-a ")).toBe("HCM-A01-1-A");
  });

  it("warehouse = segment before the first hyphen, whole code when there is none", () => {
    expect(warehouseOf("hn-a01-2-03")).toBe("HN");
    expect(warehouseOf("HN-RCV01")).toBe("HN");
    expect(warehouseOf("HN")).toBe("HN");
  });

  it("sameLocation ignores case and spaces but never matches empty", () => {
    expect(sameLocation("hcm-a", " HCM-A ")).toBe(true);
    expect(sameLocation("", "")).toBe(false);
  });

  it("sameWarehouse is judged only when both ends are filled in", () => {
    expect(sameWarehouse("HCM-A", "")).toBe(true);
    expect(sameWarehouse("HCM-A", "HCM-B")).toBe(true);
    expect(sameWarehouse("HCM-A", "HN-A")).toBe(false);
  });
});

describe("stock rows", () => {
  it("movable = onHand - reserved whatever the status, never negative", () => {
    expect(movableQuantity({ onHand: 10, reserved: 4 })).toBe(6);
    expect(movableQuantity({ onHand: 3, reserved: 5 })).toBe(0);
  });

  it("a row hidden during a count is not movable and reads as hidden (SCRUM-146)", () => {
    const hidden = row({
      onHand: undefined,
      reserved: undefined,
      available: undefined,
      hiddenDuringCount: true,
    });
    expect(isCountHidden(hidden)).toBe(true);
    expect(movableQuantity(hidden)).toBe(0);
    // Even if a payload still carried numbers, the flag wins: the bin is under count.
    expect(movableQuantity(row({ hiddenDuringCount: true }))).toBe(0);
    expect(isCountHidden(row({}))).toBe(false);
  });

  it("finds the row a typed source points at, by location (any case) and lot", () => {
    const rows = [
      row({ lotNumber: "L1" }),
      row({ lotNumber: "L2" }),
      row({ locationCode: "HCM-B" }),
    ];
    expect(findSourceRow(rows, "hcm-a01-1-a", "L2")?.lotNumber).toBe("L2");
    expect(findSourceRow(rows, "HCM-B", "")?.locationCode).toBe("HCM-B");
    expect(findSourceRow(rows, "HCM-A01-1-A", "")).toBeUndefined();
    expect(findSourceRow(undefined, "HCM-B", "")).toBeUndefined();
  });
});

describe("destinationCodes", () => {
  it("lists usable bins and areas only, unique and sorted; NON_STORAGE areas have no code", () => {
    const layout: WarehouseLayout = {
      shelves: [
        {
          levels: [
            {
              bins: [
                { locationCode: "HCM-A01-1-B", usable: true },
                { locationCode: "HCM-A01-1-A", usable: true },
                { locationCode: "HCM-A01-1-C", usable: false },
              ],
            },
          ],
        },
      ],
      areas: [{ locationCode: "hcm-pack01", usable: true }, { usable: null }],
    };
    expect(destinationCodes(layout)).toEqual(["HCM-A01-1-A", "HCM-A01-1-B", "HCM-PACK01"]);
    expect(destinationCodes(undefined)).toEqual([]);
  });
});
