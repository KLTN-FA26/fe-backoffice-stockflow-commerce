import { describe, expect, it } from "vitest";

import { MOVE_MESSAGES } from "@/constants/move";

import { PUTAWAY_DETAIL_LABELS } from "@/constants";

import {
  cartonProblem,
  cartonSearchParams,
  cartonsAlreadyAt,
  cartonsInWarehouse,
  destinationCodes,
  isInWarehouse,
  normalizeLpn,
  suggestionItems,
  suggestionLpns,
  toScanned,
  warehouseOf,
} from "./selectors";

import type { Carton, ScannedCarton, WarehouseLayout } from "./types";

const carton = (patch: Partial<Carton> = {}): Carton => ({
  lpn: "LPN-20261111-000001",
  sku: "SOFA-3S-GREY",
  lotNumber: null,
  onHand: 1,
  reserved: 0,
  status: "IN_STOCK",
  locationCode: "HCM-A01-2-B",
  ...patch,
});

describe("location / LPN helpers", () => {
  it("warehouse prefix is the segment before the first hyphen (BE LocationId.warehouseCode)", () => {
    expect(warehouseOf(" hcm-a01-1-a ")).toBe("HCM");
    expect(warehouseOf("HCMONLY")).toBe("HCMONLY");
    expect(isInWarehouse("hcm-a01", "HCM")).toBe(true);
    expect(isInWarehouse("HCMX-A01", "HCM")).toBe(false);
  });

  it("normalizes a scanned LPN", () => {
    expect(normalizeLpn("  lpn-1 ")).toBe("LPN-1");
  });
});

describe("cartonProblem (docs 11 §4.1 bước 1)", () => {
  it("a free carton in stock in the tab warehouse may be added", () => {
    expect(cartonProblem(carton(), "HCM")).toBeNull();
  });

  it("BR-05: a carton held for an order is refused", () => {
    expect(cartonProblem(carton({ reserved: 1 }), "HCM")).toBe(
      MOVE_MESSAGES.held("LPN-20261111-000001"),
    );
  });

  it("BR-04: only an IN_STOCK carton moves", () => {
    expect(cartonProblem(carton({ status: "RECEIVING" }), "HCM")).toBe(
      MOVE_MESSAGES.notInStock("LPN-20261111-000001", "RECEIVING"),
    );
  });

  it("BR-01: a carton of another warehouse (or nowhere) is refused", () => {
    const other = MOVE_MESSAGES.cartonOtherWarehouse("LPN-20261111-000001", "HCM");
    expect(cartonProblem(carton({ locationCode: "HN-A01-1-A" }), "hcm")).toBe(other);
    expect(cartonProblem(carton({ locationCode: null }), "HCM")).toBe(other);
  });
});

describe("cartonsAlreadyAt", () => {
  const rows: ScannedCarton[] = [
    toScanned(carton()),
    toScanned(carton({ lpn: "LPN-2", locationCode: "HCM-A02-1-A" })),
    { lpn: "LPN-3", sku: null, lotNumber: null, onHand: null, locationCode: null },
  ];
  it("names the cartons already at the destination (BE 422 VALIDATION_FAILED)", () => {
    expect(cartonsAlreadyAt(rows, " hcm-a01-2-b")).toEqual(["LPN-20261111-000001"]);
    expect(cartonsAlreadyAt(rows, "HCM-B01-1-A")).toEqual([]);
    expect(cartonsAlreadyAt(rows, "")).toEqual([]);
  });
});

describe("destinationCodes (docs 11 §4.1 bước 2)", () => {
  const layout: WarehouseLayout = {
    shelves: [
      {
        levels: [
          {
            bins: [
              { locationCode: "hcm-a01-1-b", usable: true },
              { locationCode: "HCM-A01-1-C", usable: false },
              { locationCode: "HCM-A01-2-B", usable: true },
            ],
          },
        ],
      },
    ],
    areas: [
      { locationCode: "HCM-PACK01", usable: true, type: "PACKING" },
      // BR-09: khu tập kết không phải đích chuyển tay
      { locationCode: "HCM-STG01", usable: true, type: "STAGING" },
      { locationCode: null, usable: null },
    ],
  };

  it("usable bins and areas, without STAGING, sorted", () => {
    expect(destinationCodes(layout)).toEqual(["HCM-A01-1-B", "HCM-A01-2-B", "HCM-PACK01"]);
  });

  it("leaves out the current location of the chosen cartons", () => {
    expect(destinationCodes(layout, ["hcm-a01-2-b"])).toEqual(["HCM-A01-1-B", "HCM-PACK01"]);
  });

  it("no layout → no suggestions", () => {
    expect(destinationCodes(undefined)).toEqual([]);
  });
});

describe("carton finder", () => {
  it("a location code of the tab warehouse searches by location, anything else by SKU", () => {
    expect(cartonSearchParams(" hcm-a01-2-b ", "HCM")).toEqual({ location: "HCM-A01-2-B" });
    expect(cartonSearchParams("sofa-3s-grey", "HCM")).toEqual({ sku: "SOFA-3S-GREY" });
    expect(cartonSearchParams("  ", "HCM")).toBeNull();
  });

  it("keeps only cartons of the tab warehouse", () => {
    const rows = [
      carton(),
      carton({ lpn: "LPN-HN", locationCode: "HN-A01-1-A" }),
      carton({ lpn: "X", locationCode: null }),
    ];
    expect(cartonsInWarehouse(rows, "HCM").map((row) => row.lpn)).toEqual(["LPN-20261111-000001"]);
  });
});

describe("bin suggestions (BE #412)", () => {
  it("asks with normalized, deduped, sorted LPNs — remove + re-add is the same question", () => {
    expect(suggestionLpns([" lpn-2", "LPN-1", "lpn-2", ""])).toEqual(["LPN-1", "LPN-2"]);
  });

  it("rows use the putaway reason labels; null free room stays null (unlimited)", () => {
    expect(
      suggestionItems([
        {
          locationCode: "HCM-A01-2-B",
          reason: "SAME_SKU",
          freeVolumeM3: 0.1234,
          freeWeightKg: 12.25,
        },
        {
          locationCode: "HCM-A01-3-A",
          reason: "OTHER_SKU",
          freeVolumeM3: null,
          freeWeightKg: null,
        },
      ]),
    ).toEqual([
      {
        locationCode: "HCM-A01-2-B",
        reason: PUTAWAY_DETAIL_LABELS.reason.SAME_SKU,
        freeVolume: "0,123 m³",
        freeWeight: "12,3 kg",
      },
      {
        locationCode: "HCM-A01-3-A",
        reason: PUTAWAY_DETAIL_LABELS.reason.OTHER_SKU,
        freeVolume: null,
        freeWeight: null,
      },
    ]);
  });
});
