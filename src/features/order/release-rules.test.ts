import { describe, expect, it } from "vitest";

import { depositState, releaseBlockers } from "./release-rules";

describe("depositState", () => {
  it("không phải đơn cọc → not-applicable; cọc chưa về → awaiting; đã về → received", () => {
    expect(depositState({ paymentTerm: "PREPAID", depositReceivedAt: null })).toBe(
      "not-applicable",
    );
    expect(depositState({ paymentTerm: null, depositReceivedAt: null })).toBe("not-applicable");
    expect(depositState({ paymentTerm: "DEPOSIT", depositReceivedAt: null })).toBe("awaiting");
    expect(
      depositState({ paymentTerm: "DEPOSIT", depositReceivedAt: "2026-10-20T01:00:00Z" }),
    ).toBe("received");
  });
});

describe("releaseBlockers (docs 19 BR-09)", () => {
  const deposit = { paymentTerm: "DEPOSIT", depositReceivedAt: null } as const;

  it("đơn cọc chưa nhận cọc ở Pending Payment → BR-PRD-09", () => {
    expect(releaseBlockers({ status: "Pending Payment", ...deposit })).toEqual([
      { rule: "BR-PRD-09", message: "Đơn đặt cọc chưa nhận đủ tiền cọc." },
    ]);
  });

  it("cọc đã về, hoặc không phải đơn cọc, hoặc đã qua Pending Payment → không có lý do", () => {
    expect(
      releaseBlockers({
        status: "Pending Payment",
        paymentTerm: "DEPOSIT",
        depositReceivedAt: "2026-10-20T01:00:00Z",
      }),
    ).toEqual([]);
    expect(
      releaseBlockers({
        status: "Pending Payment",
        paymentTerm: "PREPAID",
        depositReceivedAt: null,
      }),
    ).toEqual([]);
    expect(releaseBlockers({ status: "Confirmed", ...deposit })).toEqual([]);
    expect(releaseBlockers({ status: "Cancelled", ...deposit })).toEqual([]);
  });
});
