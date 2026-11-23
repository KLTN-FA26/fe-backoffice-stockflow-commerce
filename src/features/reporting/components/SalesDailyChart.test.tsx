import { cloneElement } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SalesDailyChart from "./SalesDailyChart";

import type { ReactElement } from "react";

// jsdom has no layout: give the chart a fixed size instead of the responsive wrapper.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number }> }) =>
      cloneElement(children, { width: 800, height: 300 } as never),
  };
});

const day = (d: string, ordersCount: number, revenue: number) => ({
  day: d,
  ordersCount,
  revenue,
  currency: "VND",
});

describe("SalesDailyChart (L-12)", () => {
  it("draws the orders line with straight segments, so a day with no order never dips below zero", () => {
    const { container } = render(
      <SalesDailyChart
        rows={[
          day("2026-11-01", 3, 30_000_000),
          day("2026-11-02", 0, 0),
          day("2026-11-03", 4, 40_000_000),
          day("2026-11-04", 0, 0),
        ]}
      />,
    );
    const line = container.querySelector(".recharts-line-curve");
    expect(line).not.toBeNull();
    const d = line?.getAttribute("d") ?? "";
    // A smoothed ("monotone") curve uses cubic Bézier commands (C); a linear line only M / L.
    expect(d).not.toMatch(/C/);
    expect(d).toMatch(/L/);
  });
});
