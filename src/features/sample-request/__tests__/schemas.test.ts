import { describe, expect, it } from "vitest";

import { sampleSpecInputSchema } from "../schemas";

const SPEC = {
  designSnapshotId: "5f1a2b3c-0000-4000-8000-000000000001",
  blankSku: "CUP-PAPER-12OZ-WHT",
  quantity: "5",
  dueDate: "",
};

describe("sampleSpecInputSchema.blankSku — BE CreateSampleRequestRequest @ValidSku (PR #70 review)", () => {
  it.each(["CUP_12", "AB", "A", "cup.12oz", "CUP-PAPER-12OZ-WHT"])("accepts %s", (blankSku) => {
    expect(sampleSpecInputSchema.safeParse({ ...SPEC, blankSku }).success).toBe(true);
  });

  it.each(["-CUP", ".CUP", "CUP 12", "A".repeat(65)])("refuses %s", (blankSku) => {
    expect(sampleSpecInputSchema.safeParse({ ...SPEC, blankSku }).success).toBe(false);
  });

  it("sends the SKU upper-cased, as BE stores it", () => {
    expect(sampleSpecInputSchema.parse({ ...SPEC, blankSku: "cup_12" }).blankSku).toBe("CUP_12");
  });
});
