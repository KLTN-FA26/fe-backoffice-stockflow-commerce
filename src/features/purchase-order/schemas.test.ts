import { describe, expect, it } from "vitest";

import { isExpectedDatePast } from "./components/create/helpers";
import { createPoSchema, receiveGoodsInputSchema } from "./schemas";

const validPo = {
  supplierId: "SUP-001",
  currency: "VND",
  expectedAt: "2026-10-07",
  lines: [
    { sku: "SKU-001", description: null, quantityOrdered: 10, unitPrice: 50000 },
    { sku: "SKU-002", description: null, quantityOrdered: 5, unitPrice: 0 },
  ],
};

const issuePaths = (input: unknown) => {
  const r = createPoSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("createPoSchema — Input layer (BE CreatePurchaseOrderRequest)", () => {
  it("accepts a valid PO (unitPrice 0 allowed — BE @PositiveOrZero)", () => {
    expect(createPoSchema.safeParse(validPo).success).toBe(true);
  });

  it("requires a supplier", () => {
    expect(issuePaths({ ...validPo, supplierId: "  " })).toContain("supplierId");
  });

  it("requires at least one line (BE @NotEmpty)", () => {
    expect(issuePaths({ ...validPo, lines: [] })).toContain("lines");
  });

  it("BR-07 (docs 02 §6): currency must be one supported code for the whole PO", () => {
    expect(issuePaths({ ...validPo, currency: "EUR" })).toContain("currency");
  });

  it.each([0, -1, 1.5])("quantityOrdered %s is rejected (BE int @Positive)", (q) => {
    const lines = [{ ...validPo.lines[0], quantityOrdered: q }];
    expect(issuePaths({ ...validPo, lines })).toContain("lines.0.quantityOrdered");
  });

  it("negative unitPrice is rejected", () => {
    const lines = [{ ...validPo.lines[0], unitPrice: -1 }];
    expect(issuePaths({ ...validPo, lines })).toContain("lines.0.unitPrice");
  });

  it("expectedAt must be YYYY-MM-DD or null", () => {
    expect(issuePaths({ ...validPo, expectedAt: "07/10/2026" })).toContain("expectedAt");
    expect(createPoSchema.safeParse({ ...validPo, expectedAt: null }).success).toBe(true);
  });

  it("ASSUMPTION: duplicate SKU in one PO is rejected", () => {
    const lines = [validPo.lines[0], { ...validPo.lines[0], quantityOrdered: 1 }];
    expect(issuePaths({ ...validPo, lines })).toContain("lines");
  });

  it("BR-06 (docs 02 §6): past expected date is NOT blocked by the schema, only warned", () => {
    expect(createPoSchema.safeParse({ ...validPo, expectedAt: "2020-01-01" }).success).toBe(true);
    expect(isExpectedDatePast("2020-01-01", "2026-09-30")).toBe(true);
    expect(isExpectedDatePast("2026-10-07", "2026-09-30")).toBe(false);
  });
});

describe("receiveGoodsInputSchema (BE ReceiveGoodsRequest)", () => {
  it("accepts positive integer quantities", () => {
    expect(
      receiveGoodsInputSchema.safeParse({ lines: [{ lineId: "l-1", quantity: 3 }] }).success,
    ).toBe(true);
  });

  it("rejects an empty receipt (BE @NotEmpty)", () => {
    expect(receiveGoodsInputSchema.safeParse({ lines: [] }).success).toBe(false);
  });

  it.each([0, 2.5])("rejects quantity %s", (quantity) => {
    expect(
      receiveGoodsInputSchema.safeParse({ lines: [{ lineId: "l-1", quantity }] }).success,
    ).toBe(false);
  });
});
