import { describe, expect, it } from "vitest";

import { fromProcurementDraft, procurementDraftSchema, toProcurementDraft } from "./form-model";
import { readMockSkuProcurementSettings } from "./mock-fixtures";
import { readProcurementSupplierChoices } from "./service";

describe("FE procurement draft conversions", () => {
  it("round-trips unknown item terms without default/preferred or pack-size semantics", () => {
    const current = readMockSkuProcurementSettings("SKU-001-BLK-L", 60);
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
    const current = readMockSkuProcurementSettings("SKU-001-BLK-L", 60);
    const draft = toProcurementDraft(current);
    draft.reorderPoint = "";
    draft.defaultSupplierId = "";
    const result = fromProcurementDraft(draft, current, readProcurementSupplierChoices(true));
    expect(result.reorderPoint).toBeNull();
    expect(result.defaultSupplierId).toBeNull();
    expect(result.defaultSupplierName).toBeNull();
    expect(result.suppliers[0]?.leadTimeDays).toBeNull();
  });

  it("accepts zero and decimals but rejects negative or nonfinite quantities", () => {
    const draft = toProcurementDraft(readMockSkuProcurementSettings("SKU-001-BLK-L", 60));
    for (const value of ["", "0", "2.5"]) {
      expect(procurementDraftSchema.safeParse({ ...draft, reorderPoint: value }).success).toBe(
        true,
      );
    }
    for (const value of ["-1", "Infinity", "NaN", "not a number"]) {
      expect(procurementDraftSchema.safeParse({ ...draft, reorderPoint: value }).success).toBe(
        false,
      );
    }
  });
});
