import { describe, expect, it } from "vitest";

import {
  orderStatusCountListDto,
  rebuildResultDto,
  salesDailyListDto,
  salesSummaryDto,
  topProductListDto,
} from "./schemas";

const PERIOD = { ordersCount: 4, revenue: 5_000_000, averageOrderValue: 1_250_000 };

describe("reporting contract (BE PR #170)", () => {
  it("parses sales-daily rows, zero days included", () => {
    const rows = salesDailyListDto.parse([
      { day: "2026-10-01", ordersCount: 0, revenue: 0, currency: "VND" },
      { day: "2026-10-02", ordersCount: 3, revenue: 3_750_000, currency: "VND" },
    ]);
    expect(rows).toHaveLength(2);
  });

  it("rejects a malformed day or a negative count", () => {
    expect(
      salesDailyListDto.safeParse([{ day: "1/10", ordersCount: 0, revenue: 0, currency: "VND" }])
        .success,
    ).toBe(false);
    expect(
      salesDailyListDto.safeParse([
        { day: "2026-10-01", ordersCount: -1, revenue: 0, currency: "VND" },
      ]).success,
    ).toBe(false);
  });

  it("top products: productName is omitted when null", () => {
    const [named, unnamed] = topProductListDto.parse([
      { sku: "A", productName: "Áo", quantitySold: 2, revenue: 100 },
      { sku: "B", quantitySold: 1, revenue: 50 },
    ]);
    expect(named.productName).toBe("Áo");
    expect(unnamed.productName).toBeUndefined();
  });

  it("order status counts keep unknown codes (a newer BE status must not break the page)", () => {
    expect(orderStatusCountListDto.parse([{ status: "BRAND_NEW", count: 0 }])).toHaveLength(1);
  });

  it("summary: the three change percents are optional", () => {
    const base = {
      from: "2026-10-01",
      to: "2026-10-07",
      previousFrom: "2026-09-24",
      previousTo: "2026-09-30",
      currency: "VND",
      current: PERIOD,
      previous: { ordersCount: 0, revenue: 0, averageOrderValue: 0 },
    };
    const omitted = salesSummaryDto.parse(base);
    expect(omitted.revenueChangePercent).toBeUndefined();
    const present = salesSummaryDto.parse({ ...base, revenueChangePercent: -12.5 });
    expect(present.revenueChangePercent).toBe(-12.5);
  });

  it("rebuild result", () => {
    expect(
      rebuildResultDto.parse({
        from: "2026-10-01",
        to: "2026-10-07",
        days: 7,
        ordersSeen: 10,
        ordersCounted: 9,
      }).ordersCounted,
    ).toBe(9);
  });
});
