import { describe, expect, it } from "vitest";

import { creditProfileDtoSchema, customerCreateInputSchema } from "../schemas";

const PROFILE = {
  customerId: "c-1",
  configured: true,
  creditLimit: 50_000_000,
  creditTermDays: 30,
  currency: "VND",
  version: 2,
};

describe("creditProfileDtoSchema — BE GET /customers/{id}/credit-profile", () => {
  it("parses the credit limit and days without payment terms (docs 15 BR-01)", () => {
    expect(creditProfileDtoSchema.safeParse(PROFILE).success).toBe(true);
  });

  it("parses a customer whose credit was never configured", () => {
    expect(
      creditProfileDtoSchema.safeParse({
        customerId: "c-1",
        configured: false,
        currency: "VND",
        version: -1,
      }).success,
    ).toBe(true);
  });
});

describe("customerCreateInputSchema.depositPercent — required and checked only for DEPOSIT", () => {
  const base = {
    companyName: "Công ty Mộc An",
    taxCode: "",
    contactName: "Chị An",
    email: "mua@mocan.vn",
    phone: "",
  };

  it("DEPOSIT: empty → asks for it, 33.333 → 2 decimals, 0 → range, 30 → ok", () => {
    const issue = (depositPercent: string) =>
      customerCreateInputSchema
        .safeParse({ ...base, paymentTerm: "DEPOSIT", depositPercent })
        .error?.issues.find((i) => i.path[0] === "depositPercent")?.message;
    expect(issue("")).toBe("Nhập tỷ lệ cọc đã thoả thuận");
    expect(issue("33.333")).toMatch(/2 chữ số thập phân/);
    expect(issue("0")).toMatch(/nhỏ hơn 100/);
    expect(issue("30")).toBeUndefined();
  });

  it("PREPAID: a stale value left in the hidden field does not block submit", () => {
    expect(
      customerCreateInputSchema.safeParse({
        ...base,
        paymentTerm: "PREPAID",
        depositPercent: "100",
      }).success,
    ).toBe(true);
  });
});
