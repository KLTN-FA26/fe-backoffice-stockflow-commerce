import { describe, expect, it } from "vitest";

import {
  creditProfileDtoSchema,
  customerCreateInputSchema,
  legalProfileInputSchema,
} from "../schemas";

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

describe("legalProfileInputSchema — BE SaveLegalProfileRequest rules", () => {
  const base = {
    registeredAddress: "12 Nguyễn Huệ",
    representativeName: "Nguyễn Văn An",
    representativeTitle: "Giám đốc",
    invoiceEmail: "",
    accountNumber: "",
    bankName: "",
    accountHolder: "",
  };
  const issues = (patch: Record<string, string>) =>
    legalProfileInputSchema.safeParse({ ...base, ...patch }).error?.issues ?? [];
  const bank = { bankName: "Vietcombank", accountHolder: "Cty Bao Bì Xanh" };

  it("a profile without a bank account is valid", () => {
    expect(issues({})).toEqual([]);
  });

  it("account number: spaces, dots and dashes are ignored; '0123 456.789' ok, '12' rejected", () => {
    expect(issues({ ...bank, accountNumber: "0123 456.789" })).toEqual([]);
    expect(issues({ ...bank, accountNumber: "12" }).map((i) => i.path[0])).toEqual([
      "accountNumber",
    ]);
  });

  it("one bank field means all three are required", () => {
    expect(issues({ bankName: "Vietcombank" }).map((i) => i.path[0])).toEqual([
      "accountNumber",
      "accountHolder",
    ]);
  });

  it("invoice email: wrong shape rejected, blank allowed", () => {
    expect(issues({ invoiceEmail: "ketoan@" }).map((i) => i.path[0])).toEqual(["invoiceEmail"]);
    expect(issues({ invoiceEmail: "ketoan@xanh.vn" })).toEqual([]);
  });

  it("length limits: address 500, representative 200, title 100", () => {
    expect(issues({ registeredAddress: "a".repeat(501) })).toHaveLength(1);
    expect(issues({ representativeName: "a".repeat(201) })).toHaveLength(1);
    expect(issues({ representativeTitle: "a".repeat(101) })).toHaveLength(1);
    expect(issues({ registeredAddress: "a".repeat(500) })).toEqual([]);
  });
});
