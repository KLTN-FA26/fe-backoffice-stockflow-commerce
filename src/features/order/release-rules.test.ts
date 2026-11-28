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

describe("releaseBlockers (docs 07 BR-01, 15 BR-07, 17 BR-02)", () => {
  it("Pending Payment + ON_SIGNING chưa thu đủ → nêu lý do, không cần paymentTerm", () => {
    expect(releaseBlockers({ status: "Pending Payment" }, { onSigningPaid: false })).toEqual([
      {
        rule: "BR-07",
        message: "Đơn còn chờ thu đủ đợt khi ký — Kế toán kiểm tra và lập phiếu thu.",
      },
    ]);
  });

  it("ON_SIGNING đã thu đủ hoặc đơn không còn Pending Payment → không có blocker", () => {
    expect(releaseBlockers({ status: "Pending Payment" }, { onSigningPaid: true })).toEqual([]);
    expect(releaseBlockers({ status: "Confirmed" }, { onSigningPaid: false })).toEqual([]);
    expect(releaseBlockers({ status: "Cancelled" }, { onSigningPaid: false })).toEqual([]);
  });

  it("không đọc được đợt thanh toán: Pending Payment vẫn có lời giải thích theo trạng thái BE", () => {
    expect(releaseBlockers({ status: "Pending Payment" })).toEqual([
      {
        rule: "BR-07",
        message: "Đơn còn chờ thu đủ đợt khi ký — Kế toán kiểm tra và lập phiếu thu.",
      },
    ]);
  });
});
