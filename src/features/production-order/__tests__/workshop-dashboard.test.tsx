import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bePage, mockApi, renderScreen } from "@/test/api-screen";

import { WorkshopDashboard } from "../components/workshop/WorkshopDashboard";

afterEach(() => vi.restoreAllMocks());

const dashboard = (scrapRate: number | null) => ({
  openByStatus: { READY: 2, PRINTING: 1 },
  overdue: 0,
  printed: 200,
  scrap: 3,
  scrapRate,
  samplesAwaitingApproval: 0,
  today: "2026-10-23",
  periodBasis: "ACTIVITY",
});

describe("WorkshopDashboard — scrap rate (BE scrapRate = scrap / printed, a fraction)", () => {
  it("PR #70 review: 3 of 200 is 1,50 %, not 150 %", async () => {
    mockApi("WAREHOUSE_MANAGER", {
      get: {
        "/production/dashboard": () => dashboard(0.015),
        "/production/dashboard/overdue": () => bePage([]),
      },
    });
    renderScreen(<WorkshopDashboard />, "WAREHOUSE_MANAGER");
    expect(await screen.findByText(/Tỷ lệ phế 1,50\s?%/)).toBeInTheDocument();
    expect(screen.queryByText(/150,00/)).not.toBeInTheDocument();
  });

  it("nothing printed in the period (scrapRate null) → says so instead of a rate", async () => {
    mockApi("WAREHOUSE_MANAGER", {
      get: {
        "/production/dashboard": () => dashboard(null),
        "/production/dashboard/overdue": () => bePage([]),
      },
    });
    renderScreen(<WorkshopDashboard />, "WAREHOUSE_MANAGER");
    expect(await screen.findByText("Chưa in trong kỳ")).toBeInTheDocument();
  });
});
