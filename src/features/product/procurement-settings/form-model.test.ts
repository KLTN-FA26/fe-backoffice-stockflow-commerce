import { describe, expect, it } from "vitest";

import { fromProcurementDraft, procurementDraftSchema, toProcurementDraft } from "./form-model";
import { readMockSkuProcurementSettings } from "./mock-fixtures";
import { readProcurementSupplierChoices } from "./service";

describe("FE procurement draft conversions", () => {
  it.each([0, 1])("rejects duplicate suppliers when row %i changes", (changedIndex) => {
    const draft = toProcurementDraft(readMockSkuProcurementSettings("SKU-001-BLK-L"));
    const other = draft.suppliers[1 - changedIndex];
    draft.suppliers = draft.suppliers.map((supplier, index) =>
      index === changedIndex && other ? { ...supplier, supplierId: other.supplierId } : supplier,
    );
    const result = procurementDraftSchema.safeParse(draft);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path)).toEqual([
        ["suppliers", 0, "supplierId"],
        ["suppliers", 1, "supplierId"],
      ]);
      expect(procurementDraftSchema.safeParse(draft)).toEqual(result);
    }
  });

  it("does not count the independent default supplier as a duplicate mapping", () => {
    const draft = toProcurementDraft(readMockSkuProcurementSettings("SKU-001-BLK-L"));
    expect(procurementDraftSchema.safeParse(draft).success).toBe(true);
  });

  it.each([
    ["", true],
    ["1e", false],
    ["1e309", false],
    ["9007199254740993", false],
    ["0", true],
    ["2.5", true],
    ["0.0001", true],
    ["9007199254740991", true],
    ["-1", false],
  ])("checks numeric integrity for %j across every quantity field", (value, success) => {
    const draft = toProcurementDraft(readMockSkuProcurementSettings("SKU-001-BLK-L"));
    draft.suppliers = draft.suppliers.map((supplier) => ({
      ...supplier,
      leadTimeDays: value,
      moq: value,
      orderMultiple: value,
    }));
    expect(procurementDraftSchema.safeParse(draft).success).toBe(success);
  });

  it("round-trips unknown item terms without default/preferred or pack-size semantics", () => {
    const current = readMockSkuProcurementSettings("SKU-001-BLK-L");
    const result = fromProcurementDraft(
      toProcurementDraft(current),
      current,
      readProcurementSupplierChoices(true, current),
    );
    expect(result).toEqual(current);
    expect(result.suppliers[0]).not.toHaveProperty("isPreferred");
    expect(result.suppliers[0]).not.toHaveProperty("packSize");
  });

  it("clears persisted numeric values to unknown rather than zero or fallback", () => {
    const current = readMockSkuProcurementSettings("SKU-001-BLK-L");
    const draft = toProcurementDraft(current);
    draft.defaultSupplierId = "";
    const result = fromProcurementDraft(draft, current, readProcurementSupplierChoices(true));
    expect(draft).not.toHaveProperty("reorderPoint");
    expect(procurementDraftSchema.shape).not.toHaveProperty("reorderPoint");
    expect(result).not.toHaveProperty("reorderPoint");
    expect(result.defaultSupplierId).toBeNull();
    expect(result.defaultSupplierName).toBeNull();
    expect(result.suppliers[0]?.leadTimeDays).toBeNull();
  });

  it("accepts zero and decimals but rejects negative or nonfinite quantities", () => {
    const draft = toProcurementDraft(readMockSkuProcurementSettings("SKU-001-BLK-L"));
    for (const value of ["", "0", "2.5"]) {
      expect(
        procurementDraftSchema.safeParse({
          ...draft,
          suppliers: draft.suppliers.map((supplier) => ({ ...supplier, moq: value })),
        }).success,
      ).toBe(true);
    }
    for (const value of ["-1", "Infinity", "NaN", "not a number"]) {
      expect(
        procurementDraftSchema.safeParse({
          ...draft,
          suppliers: draft.suppliers.map((supplier) => ({ ...supplier, moq: value })),
        }).success,
      ).toBe(false);
    }
  });
});
