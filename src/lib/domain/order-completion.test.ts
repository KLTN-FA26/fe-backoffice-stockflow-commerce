import { describe, expect, it } from "vitest";

import { closingDate, completionChecks, endOfDays } from "./order-completion";

const facts = (over: Partial<Parameters<typeof completionChecks>[0]> = {}) => ({
  status: "Delivered",
  deliveredAt: "2026-11-01T10:00:00Z",
  completedAt: null,
  outstanding: 0,
  deliveredShipmentIds: ["s-1", "s-2"],
  invoicedShipmentIds: ["s-1", "s-2"],
  ...over,
});
const met = (checks: ReturnType<typeof completionChecks>) =>
  Object.fromEntries(checks.map((check) => [check.key, check.met]));

describe("endOfDays (BE ReturnPolicy.endOfDays)", () => {
  it("ends at Vietnam midnight after the 7th whole day following the delivery day", () => {
    // Giao 17:00 giờ VN ngày 01/11 → hết hạn 0 giờ VN ngày 09/11 = 17:00Z ngày 08/11
    expect(endOfDays("2026-11-01T10:00:00Z", 7).toISOString()).toBe("2026-11-08T17:00:00.000Z");
    // Giao 06:00 giờ VN ngày 02/11 (23:00Z ngày 01/11) → ngày giao là 02/11 theo giờ VN
    expect(endOfDays("2026-11-01T23:00:00Z", 7).toISOString()).toBe("2026-11-09T17:00:00.000Z");
  });
});

describe("completionChecks (docs 17 §4.6 bước 21 + BE WF-05 plan §4)", () => {
  it("all four met once the window passed, everything is paid, no return is open and every delivery is invoiced", () => {
    expect(met(completionChecks(facts(), new Date("2026-11-09T00:00:00Z")))).toEqual({
      returnWindow: true,
      paid: true,
      noOpenReturn: true,
      invoiced: true,
    });
  });

  it("the window is still open the day before it ends", () => {
    const checks = completionChecks(facts(), new Date("2026-11-08T16:59:59Z"));
    expect(met(checks).returnWindow).toBe(false);
    expect(checks[0]?.detail).toContain("Hết hạn lúc 0 giờ");
  });

  it("an installment still owing, an open return or a delivery without an issued invoice keeps the order delivered", () => {
    const now = new Date("2026-12-01T00:00:00Z");
    expect(met(completionChecks(facts({ outstanding: 500 }), now)).paid).toBe(false);
    expect(met(completionChecks(facts({ outstanding: null }), now)).paid).toBe(false);
    expect(met(completionChecks(facts({ status: "Return Requested" }), now)).noOpenReturn).toBe(
      false,
    );
    const missing = completionChecks(facts({ invoicedShipmentIds: ["s-1"] }), now);
    expect(met(missing).invoiced).toBe(false);
    expect(missing[3]?.detail).toBe("Còn 1 lô giao chưa có hoá đơn phát hành");
  });
});

describe("completionChecks — giữ hoàn tất (WF-05 GH-2)", () => {
  const now = new Date("2026-12-01T00:00:00Z");
  it("no hold condition when the screen does not know about holds", () => {
    expect(met(completionChecks(facts(), now))).not.toHaveProperty("notHeld");
  });

  it("an open hold keeps the order delivered; unknown is not met either", () => {
    expect(met(completionChecks(facts({ completionHeld: false }), now)).notHeld).toBe(true);
    expect(met(completionChecks(facts({ completionHeld: true }), now)).notHeld).toBe(false);
    const unknown = completionChecks(facts({ completionHeld: null }), now);
    expect(met(unknown).notHeld).toBe(false);
    expect(unknown[4]?.detail).toBe("Chưa đọc được tình trạng giữ hoàn tất");
  });
});

describe("closingDate (BE Order.close)", () => {
  it("is 30 days after completion", () => {
    expect(closingDate("2026-11-10T17:30:00Z").toISOString()).toBe("2026-12-10T17:30:00.000Z");
  });
});

describe("completionChecks — dự phòng WF-05 BO-02 (C-7)", () => {
  it("hạn đổi trả theo hợp đồng, không cố định 7 ngày", () => {
    // Giao 1/11, 7 ngày đã qua ngày 9/11 nhưng hợp đồng ghi 14 → chưa hết hạn
    const checks = completionChecks(
      facts({ returnWindowDays: 14 }),
      new Date("2026-11-10T00:00:00Z"),
    );
    expect(met(checks).returnWindow).toBe(false);
    expect(checks[0]?.label).toBe("Hết hạn đổi / trả 14 ngày");
    expect(
      met(completionChecks(facts({ returnWindowDays: 14 }), new Date("2026-11-16T00:00:00Z")))
        .returnWindow,
    ).toBe(true);
  });

  it("hợp đồng không ghi hạn → mặc định 7", () => {
    expect(completionChecks(facts({ returnWindowDays: null }))[0]?.label).toBe(
      "Hết hạn đổi / trả 7 ngày",
    );
  });
});
