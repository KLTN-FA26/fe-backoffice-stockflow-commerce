import { describe, expect, it } from "vitest";

import { STOCK_ADJUSTMENT_REASONS } from "@/constants/inventory";

import { adjustmentCreateInput, adjustmentRejectionInput } from "./schemas";

const input = {
  locationCode: "HCM-A01-1-A",
  sku: "CUP-PP-500",
  quantityDelta: -3,
  reason: "SCRAP",
};

describe("SCRUM-424 adjustment input contract", () => {
  it.each(STOCK_ADJUSTMENT_REASONS)("accepts the documented %s reason", (reason) => {
    expect(
      adjustmentCreateInput.safeParse({ ...input, reason, note: "Count correction" }).success,
    ).toBe(true);
  });

  it.each(["", "DAMAGE", "SUBCONTRACT_LOSS", "COUNT_VARIANCE"])(
    "does not send unsupported manual reason %s",
    (reason) => expect(adjustmentCreateInput.safeParse({ ...input, reason }).success).toBe(false),
  );

  it.each([0, 1.5, 1_000_001, -1_000_001])("rejects invalid delta %s", (quantityDelta) => {
    expect(adjustmentCreateInput.safeParse({ ...input, quantityDelta }).success).toBe(false);
  });

  it.each(["SCRAP", "SAMPLE"])("%s can only write down", (reason) => {
    expect(adjustmentCreateInput.safeParse({ ...input, reason, quantityDelta: 3 }).success).toBe(
      false,
    );
  });

  it("requires a nonblank note for OTHER", () => {
    expect(adjustmentCreateInput.safeParse({ ...input, reason: "OTHER", note: " " }).success).toBe(
      false,
    );
  });

  it("trims location and optional explanation", () => {
    const result = adjustmentCreateInput.parse({
      ...input,
      locationCode: " HCM-A01-1-A ",
      note: " reason ",
    });
    expect(result.locationCode).toBe(input.locationCode);
    expect(result.note).toBe("reason");
  });

  it("requires a rejection reason", () => {
    expect(adjustmentRejectionInput.safeParse({ reason: " " }).success).toBe(false);
  });
});
