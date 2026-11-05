import { describe, expect, it } from "vitest";

import { REPORT_ORDER_STATUS_TO_FE } from "@/constants/reporting";
import { ORDER_STATUSES } from "@/constants/statuses";

import {
  formatChange,
  hasSales,
  summaryCards,
  toStatusBars,
  topProductLabel,
  visibleStatusBars,
} from "./selectors";

describe("reporting selectors", () => {
  it("every mapped BE order status is a real FE order status", () => {
    for (const fe of Object.values(REPORT_ORDER_STATUS_TO_FE)) {
      expect(ORDER_STATUSES as readonly string[]).toContain(fe);
    }
  });

  it("status bars use the shared Vietnamese label; ON_HOLD stays visible at zero", () => {
    const bars = toStatusBars([
      { status: "ON_HOLD", count: 0 },
      { status: "CONFIRMED", count: 5 },
      { status: "PICKING", count: 0 },
      { status: "FROM_THE_FUTURE", count: 2 },
    ]);
    expect(bars.find((b) => b.code === "ON_HOLD")?.label).toBe("Tạm giữ");
    expect(bars.find((b) => b.code === "FROM_THE_FUTURE")?.label).toBe("FROM_THE_FUTURE");
    expect(visibleStatusBars(bars).map((b) => b.code)).toEqual([
      "ON_HOLD",
      "CONFIRMED",
      "FROM_THE_FUTURE",
    ]);
  });

  it("detects an empty range", () => {
    expect(hasSales([{ day: "2026-10-01", ordersCount: 0, revenue: 0, currency: "VND" }])).toBe(
      false,
    );
    expect(hasSales([{ day: "2026-10-01", ordersCount: 1, revenue: 9, currency: "VND" }])).toBe(
      true,
    );
  });

  it("falls back to the SKU when the product has no name", () => {
    expect(topProductLabel({ sku: "S1", quantitySold: 1, revenue: 1 })).toBe("S1");
    expect(topProductLabel({ sku: "S1", productName: "Áo", quantitySold: 1, revenue: 1 })).toBe(
      "Áo",
    );
  });

  it("formats the change with sign and vi-VN decimals", () => {
    expect(formatChange(12.5)).toBe("+12,5%");
    expect(formatChange(-3)).toBe("-3,0%");
    expect(formatChange(0)).toBe("0,0%");
  });

  it("summary cards carry an undefined change when the BE omits it", () => {
    const period = { ordersCount: 2, revenue: 10, averageOrderValue: 5 };
    const cards = summaryCards({
      from: "2026-10-01",
      to: "2026-10-02",
      previousFrom: "2026-09-29",
      previousTo: "2026-09-30",
      currency: "VND",
      current: period,
      previous: period,
      revenueChangePercent: 4,
    });
    expect(cards.map((c) => c.change)).toEqual([4, undefined, undefined]);
  });
});
