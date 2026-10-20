import { describe, expect, it } from "vitest";

import { MOVE_LIMITS, MOVE_MESSAGES } from "@/constants/move";

import { moveCreateInput, stockMoveDto, stockRowListDto, warehouseLayoutDto } from "./schemas";

const valid = {
  sku: "CUP-PP-500",
  fromLocation: "HCM-A01-1-A",
  toLocation: "HCM-PACK01",
  quantity: 5,
};

function messages(input: unknown) {
  const result = moveCreateInput.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("moveCreateInput (BE MoveStockRequest)", () => {
  it("accepts a move inside one warehouse; lot is optional", () => {
    expect(moveCreateInput.safeParse(valid).success).toBe(true);
    expect(moveCreateInput.safeParse({ ...valid, lotNumber: "LOT-1" }).success).toBe(true);
  });

  it.each([
    ["sku required", { sku: "" }],
    ["sku malformed (@ValidSku)", { sku: "-bad sku" }],
    ["from required", { fromLocation: " " }],
    ["to required", { toLocation: "" }],
    ["lot longer than 64", { lotNumber: "L".repeat(MOVE_LIMITS.lotLength + 1) }],
    ["location longer than 64", { toLocation: `HCM-${"X".repeat(MOVE_LIMITS.locationLength)}` }],
    ["quantity below 1", { quantity: 0 }],
    ["quantity above 1,000,000", { quantity: MOVE_LIMITS.quantityMax + 1 }],
    ["quantity fractional", { quantity: 1.5 }],
    ["quantity missing", { quantity: Number.NaN }],
  ])("rejects: %s", (_name, patch) => {
    expect(moveCreateInput.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it("accepts the limits themselves", () => {
    expect(moveCreateInput.safeParse({ ...valid, quantity: MOVE_LIMITS.quantityMin }).success).toBe(
      true,
    );
    expect(moveCreateInput.safeParse({ ...valid, quantity: MOVE_LIMITS.quantityMax }).success).toBe(
      true,
    );
  });

  it("requires two different locations, ignoring case and spaces (BE LocationId trims + upper-cases)", () => {
    expect(messages({ ...valid, toLocation: " hcm-a01-1-a " })).toEqual([
      MOVE_MESSAGES.sameLocation,
    ]);
  });

  it("docs 11 BR-01: both locations in one warehouse (prefix before the first hyphen)", () => {
    expect(messages({ ...valid, toLocation: "HN-PACK01" })).toEqual([MOVE_MESSAGES.crossWarehouse]);
    expect(messages({ ...valid, toLocation: "hcm-pack01" })).toEqual([]);
  });
});

describe("response contracts", () => {
  it("StockMoveResponse omits a null lot (Jackson NON_NULL)", () => {
    const move = stockMoveDto.parse({
      movementId: crypto.randomUUID(),
      sku: "CUP-PP-500",
      fromLocation: "HCM-A01-1-A",
      toLocation: "HCM-PACK01",
      quantity: 5,
      occurredAt: "2026-10-19T03:00:00Z",
    });
    expect(move.lotNumber).toBeUndefined();
  });

  it("StockItemResponse list: lot and expiry may be omitted, status stays open", () => {
    const rows = stockRowListDto.parse([
      {
        id: crypto.randomUUID(),
        sku: "CUP-PP-500",
        locationCode: "HCM-A01-1-A",
        onHand: 10,
        reserved: 4,
        available: 6,
        status: "A_STATUS_FROM_THE_FUTURE",
      },
    ]);
    expect(rows[0]?.status).toBe("A_STATUS_FROM_THE_FUTURE");
  });

  it("layout keeps only what suggestions need; an area without code/usable is tolerated", () => {
    const layout = warehouseLayoutDto.parse({
      warehouse: { id: "ignored" },
      shelves: [{ levels: [{ bins: [{ locationCode: "HCM-A01-1-A", usable: true }] }] }],
      areas: [{ type: "NON_STORAGE" }, { locationCode: "HCM-PACK01", usable: true }],
    });
    expect(layout.areas).toHaveLength(2);
  });

  it("rejects a move response with a non-positive quantity", () => {
    expect(
      stockMoveDto.safeParse({
        movementId: crypto.randomUUID(),
        sku: "X",
        fromLocation: "A-1",
        toLocation: "A-2",
        quantity: 0,
        occurredAt: "2026-10-19T03:00:00Z",
      }).success,
    ).toBe(false);
  });
});
