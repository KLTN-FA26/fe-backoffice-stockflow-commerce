import { describe, expect, it } from "vitest";

import { quoteFormSchema, quoteLineInputSchema } from "../schemas";

import type { QuoteFormValues } from "../types";

const LINE = {
  blankSku: "CUP-PAPER-12OZ-WHT",
  designSnapshotId: "01a13ad1-92b3-7056-8b50-aaa9da1f1968",
  printSpec: "",
  quantity: "1000",
  useListPrice: true,
  tiers: [],
};

const form = (rest: Partial<QuoteFormValues>): QuoteFormValues => ({
  customerId: "01a13ad1-92b3-7056-8b50-aaa9da1f1969",
  paymentTerm: "DEPOSIT",
  depositPercent: "",
  validUntil: "2999-12-31",
  terms: "",
  lines: [LINE],
  ...rest,
});

describe("quoteLineInputSchema.blankSku — same pattern as BE @ValidSku (common.domain.Sku)", () => {
  it.each(["CUP_PAPER.12OZ", "A", "b2", "cup-paper-12oz-wht"])("accepts %s", (blankSku) => {
    expect(quoteLineInputSchema.safeParse({ ...LINE, blankSku }).success).toBe(true);
  });

  it("upper-cases what the user typed", () => {
    expect(quoteLineInputSchema.parse({ ...LINE, blankSku: "cup_a" }).blankSku).toBe("CUP_A");
  });

  it.each(["-CUP", "_CUP", "CUP PAPER", "A".repeat(65)])("refuses %s", (blankSku) => {
    expect(quoteLineInputSchema.safeParse({ ...LINE, blankSku }).success).toBe(false);
  });
});

describe("quoteFormSchema.depositPercent — BE @Digits(integer = 3, fraction = 2), 0 < x < 100", () => {
  it.each(["", "30", "33.33", "0.01", "99.99"])("DEPOSIT accepts %j", (depositPercent) => {
    expect(quoteFormSchema.safeParse(form({ depositPercent })).success).toBe(true);
  });

  it.each(["33.333", "100", "0", "abc", "-5"])(
    "DEPOSIT refuses %j on the field",
    (depositPercent) => {
      const result = quoteFormSchema.safeParse(form({ depositPercent }));
      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain("depositPercent");
    },
  );

  it("a stale value of the hidden field does not block another payment term", () => {
    expect(
      quoteFormSchema.safeParse(form({ paymentTerm: "PREPAID", depositPercent: "33.333" })).success,
    ).toBe(true);
  });
});
