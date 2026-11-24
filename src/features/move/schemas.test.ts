import { describe, expect, it } from "vitest";

import { MOVE_LIMITS, MOVE_MESSAGES } from "@/constants/move";

import {
  cartonDto,
  movedCartonsDto,
  moveCreateInput,
  moveInWarehouseInput,
  warehouseLayoutDto,
} from "./schemas";

const valid = { lpns: ["LPN-20261109-000001"], toLocation: "HCM-A01-1-A" };

function messages(input: unknown, schema = moveCreateInput) {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("moveCreateInput (BE MoveStockPackagesRequest — docs 11 BR-04, BR-07)", () => {
  it("accepts whole cartons by LPN and one destination — no SKU, lot, source or quantity", () => {
    expect(moveCreateInput.parse(valid)).toEqual(valid);
    // Trường cũ của MoveStockRequest không còn trong hợp đồng
    expect(moveCreateInput.parse({ ...valid, sku: "X", quantity: 5 })).toEqual(valid);
  });

  it("trims, upper-cases and drops duplicate LPNs; upper-cases the destination", () => {
    expect(
      moveCreateInput.parse({
        lpns: [" lpn-20261109-000001 ", "LPN-20261109-000001", "LPN-20261109-000002"],
        toLocation: " hcm-a01-1-a ",
      }),
    ).toEqual({
      lpns: ["LPN-20261109-000001", "LPN-20261109-000002"],
      toLocation: "HCM-A01-1-A",
    });
  });

  it("needs 1 to 500 cartons (@NotEmpty @Size(max = 500))", () => {
    expect(messages({ ...valid, lpns: [] })).toContain(MOVE_MESSAGES.noCartons);
    const many = Array.from({ length: MOVE_LIMITS.lpnsMax + 1 }, (_, i) => `LPN-${i}`);
    expect(messages({ ...valid, lpns: many })).toContain(MOVE_MESSAGES.tooManyCartons);
    expect(messages({ ...valid, lpns: many.slice(0, MOVE_LIMITS.lpnsMax) })).toEqual([]);
  });

  it("refuses a blank LPN or one longer than 30 characters (@NotBlank @Size(max = 30))", () => {
    expect(messages({ ...valid, lpns: ["  "] })).toContain(MOVE_MESSAGES.required);
    expect(messages({ ...valid, lpns: ["L".repeat(MOVE_LIMITS.lpnLength + 1)] })).toContain(
      MOVE_MESSAGES.lpnLength,
    );
    expect(messages({ ...valid, lpns: ["L".repeat(MOVE_LIMITS.lpnLength)] })).toEqual([]);
  });

  it("needs a destination of at most 64 characters", () => {
    expect(messages({ ...valid, toLocation: " " })).toContain(MOVE_MESSAGES.required);
    expect(
      messages({ ...valid, toLocation: "H".repeat(MOVE_LIMITS.locationLength + 1) }),
    ).not.toEqual([]);
  });

  it("in the warehouse tab, the destination belongs to that warehouse (docs 11 BR-01)", () => {
    const inHcm = moveInWarehouseInput("hcm");
    expect(messages(valid, inHcm)).toEqual([]);
    expect(messages({ ...valid, toLocation: "HN-A01-1-A" }, inHcm)).toEqual([
      MOVE_MESSAGES.otherWarehouse("hcm"),
    ]);
  });
});

describe("DTOs", () => {
  it("MovedStockPackageResponse[]: quantity and unit may be null", () => {
    const moved = movedCartonsDto.parse([
      {
        lpn: "LPN-1",
        sku: "SOFA-3S-GREY",
        unitOfMeasure: "CARTON",
        quantity: 1000,
        locationCode: "HCM-A01-1-A",
        status: "IN_STOCK",
      },
      {
        lpn: "LPN-2",
        sku: "SOFA-3S-GREY",
        unitOfMeasure: null,
        quantity: null,
        locationCode: "HCM-A01-1-A",
        status: "IN_STOCK",
      },
    ]);
    expect(moved).toHaveLength(2);
    expect(movedCartonsDto.safeParse({ lpn: "LPN-1" }).success).toBe(false);
  });

  it("StockPackageDetailResponse keeps an unknown status verbatim", () => {
    const carton = cartonDto.parse({
      lpn: "LPN-1",
      sku: "SOFA-3S-GREY",
      onHand: 1,
      reserved: 0,
      status: "SOMETHING_NEW",
      contents: [],
    });
    expect(carton.status).toBe("SOMETHING_NEW");
    expect(carton.locationCode).toBeUndefined();
  });

  it("layout keeps the area type (STAGING is not a destination)", () => {
    const layout = warehouseLayoutDto.parse({
      shelves: [],
      areas: [{ locationCode: "HCM-STG01", usable: true, type: "STAGING" }, {}],
    });
    expect(layout.areas[0]?.type).toBe("STAGING");
  });
});
