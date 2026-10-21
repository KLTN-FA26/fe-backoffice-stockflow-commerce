import { describe, expect, it } from "vitest";

import { creditProfileDtoSchema } from "../schemas";

const PROFILE = {
  customerId: "c-1",
  configured: true,
  allowPrepaid: true,
  allowDeposit: true,
  allowCredit: true,
  defaultPaymentTerm: "DEPOSIT",
  depositPercent: 30,
  creditLimit: 50_000_000,
  creditTermDays: 30,
  currency: "VND",
  version: 2,
};

describe("creditProfileDtoSchema — BE GET /customers/{id}/credit-profile (develop 492a2d61)", () => {
  it.each(["BEFORE_DELIVERY", "ON_DELIVERY", "ON_CREDIT", null])(
    "parses depositBalancePolicy %j (ON_CREDIT: dbf7da04, deposit balance on credit)",
    (depositBalancePolicy) => {
      expect(creditProfileDtoSchema.safeParse({ ...PROFILE, depositBalancePolicy }).success).toBe(
        true,
      );
    },
  );
});
