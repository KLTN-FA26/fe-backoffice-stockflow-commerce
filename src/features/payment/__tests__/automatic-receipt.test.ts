import { describe, expect, it } from "vitest";

import { BANK_FEED_USER_ID } from "@/constants/bank-transaction";

import { isAutomaticReceipt } from "../selectors";

describe("phiếu thu tự lập từ SePay (BE PR #490)", () => {
  it("người lập là tài khoản Bank feed (SePay) → Tự động", () => {
    expect(isAutomaticReceipt({ recordedBy: BANK_FEED_USER_ID })).toBe(true);
  });
  it("Kế toán lập hoặc thiếu người lập → không", () => {
    expect(isAutomaticReceipt({ recordedBy: "u-accountant" })).toBe(false);
    expect(isAutomaticReceipt({ recordedBy: null })).toBe(false);
  });
});
