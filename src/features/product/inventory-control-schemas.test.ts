import { describe, expect, it } from "vitest";

import { toInventoryControlRequest } from "./inventory-control-api";
import { beInventoryControlSchema, inventoryControlFormSchema } from "./inventory-control-schemas";

import type { InventoryControlFormValues } from "./inventory-control-schemas";

const form = (over: Partial<InventoryControlFormValues> = {}): InventoryControlFormValues => ({
  reorderPoint: "20",
  safetyStock: "5",
  removalStrategy: "FEFO",
  trackingMode: "NONE",
  expiryTracked: false,
  maxShelfLifeDays: "",
  ...over,
});
const issues = (values: InventoryControlFormValues) => {
  const result = inventoryControlFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((i) => String(i.path[0]));
};

describe("inventory control form (BE StockPolicy.validate)", () => {
  it("accepts a plain policy and blank thresholds (not configured)", () => {
    expect(issues(form())).toEqual([]);
    expect(issues(form({ reorderPoint: "", safetyStock: "" }))).toEqual([]);
  });

  it("thresholds are integers ≥ 0; zero is a real threshold", () => {
    expect(issues(form({ reorderPoint: "0", safetyStock: "0" }))).toEqual([]);
    expect(issues(form({ reorderPoint: "-1" }))).toEqual(["reorderPoint"]);
    expect(issues(form({ reorderPoint: "1.5" }))).toEqual(["reorderPoint"]);
  });

  it("safety stock may not exceed the reorder point (only when both are set)", () => {
    expect(issues(form({ reorderPoint: "5", safetyStock: "6" }))).toEqual(["safetyStock"]);
    expect(issues(form({ reorderPoint: "", safetyStock: "6" }))).toEqual([]);
    expect(issues(form({ reorderPoint: "5", safetyStock: "5" }))).toEqual([]);
  });

  it("expiry tracking needs lot tracking and FEFO", () => {
    expect(issues(form({ expiryTracked: true, trackingMode: "NONE" }))).toEqual(["trackingMode"]);
    expect(issues(form({ expiryTracked: true, trackingMode: "SERIAL" }))).toEqual(["trackingMode"]);
    expect(
      issues(form({ expiryTracked: true, trackingMode: "LOT", removalStrategy: "FIFO" })),
    ).toEqual(["removalStrategy"]);
    expect(issues(form({ expiryTracked: true, trackingMode: "LOT" }))).toEqual([]);
    expect(issues(form({ expiryTracked: true, trackingMode: "LOT_SERIAL" }))).toEqual([]);
  });

  it("max shelf life is 1–36500 days and only with expiry tracking", () => {
    const tracked = { expiryTracked: true, trackingMode: "LOT" as const };
    expect(issues(form({ ...tracked, maxShelfLifeDays: "36500" }))).toEqual([]);
    expect(issues(form({ ...tracked, maxShelfLifeDays: "0" }))).toEqual(["maxShelfLifeDays"]);
    expect(issues(form({ ...tracked, maxShelfLifeDays: "36501" }))).toEqual(["maxShelfLifeDays"]);
    expect(issues(form({ maxShelfLifeDays: "30" }))).toEqual(["maxShelfLifeDays"]);
  });

  it("request replaces the whole policy: blank thresholds are explicit nulls, version is the one read", () => {
    expect(toInventoryControlRequest(form({ reorderPoint: "", safetyStock: "3" }), 7)).toEqual({
      version: 7,
      reorderPoint: null,
      safetyStock: 3,
      removalStrategy: "FEFO",
      trackingMode: "NONE",
      expiryTracked: false,
      maxShelfLifeDays: null,
    });
  });
});

describe("InventoryControlResponse DTO", () => {
  const dto = {
    skuId: "s",
    sku: "CUP",
    unitOfMeasure: "EACH",
    version: 1,
    reorderPoint: null,
    safetyStock: null,
    removalStrategy: "FEFO",
    trackingMode: "LOT_SERIAL",
    expiryTracked: true,
    maxShelfLifeDays: 90,
    usableOnHand: 12,
    reorderRequired: null,
    belowSafetyStock: null,
  };

  it("parses nullable thresholds and evaluation flags", () => {
    expect(beInventoryControlSchema.parse(dto)).toMatchObject({
      reorderPoint: null,
      reorderRequired: null,
    });
  });

  it("BE non_null omits unset thresholds and flags: absent parses to null", () => {
    const {
      reorderPoint: _a,
      safetyStock: _b,
      maxShelfLifeDays: _c,
      reorderRequired: _d,
      belowSafetyStock: _e,
      ...omitted
    } = dto;
    expect(beInventoryControlSchema.parse(omitted)).toMatchObject({
      reorderPoint: null,
      safetyStock: null,
      maxShelfLifeDays: null,
      reorderRequired: null,
      belowSafetyStock: null,
    });
  });

  it("rejects an unknown strategy or tracking mode", () => {
    expect(beInventoryControlSchema.safeParse({ ...dto, removalStrategy: "LIFO" }).success).toBe(
      false,
    );
    expect(beInventoryControlSchema.safeParse({ ...dto, trackingMode: "BATCH" }).success).toBe(
      false,
    );
  });
});
