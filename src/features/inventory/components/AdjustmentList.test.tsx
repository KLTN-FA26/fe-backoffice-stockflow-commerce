import { cleanup, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { INVENTORY_LABELS, INVENTORY_ROUTES } from "@/constants/inventory";
import { STOCK_ADJUSTMENT_STATUS } from "@/constants/statuses";

import { api } from "@/lib/api/client";

import { adjustmentFixture, renderInventory, setInventoryTestActor } from "../test-support";
import { AdjustmentList } from "./AdjustmentList";

const server = setupServer();
const originalBaseUrl = api.defaults.baseURL;
const endpoint = "http://localhost/api/v1/inventory/adjustments";
beforeAll(() => {
  api.defaults.baseURL = "http://localhost/api";
  server.listen({ onUnhandledRequest: "error" });
});
beforeEach(() => {
  localStorage.clear();
  setInventoryTestActor("Warehouse Manager");
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
  api.defaults.baseURL = originalBaseUrl;
});

describe("adjustment queue", () => {
  it("loads the URL approval queue and links its detail", async () => {
    const fixture = adjustmentFixture();
    server.use(
      http.get(endpoint, ({ request }) => {
        const params = new URL(request.url).searchParams;
        expect(params.get("status")).toBe(STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL);
        expect(params.get("page")).toBe("1");
        return HttpResponse.json({
          success: true,
          data: {
            items: [fixture],
            page: 1,
            size: 15,
            totalElements: 16,
            totalPages: 2,
            hasNext: false,
            hasPrevious: true,
          },
        });
      }),
    );
    renderInventory(<AdjustmentList />, "?status=PENDING_APPROVAL&page=2");
    expect(await screen.findByRole("link", { name: fixture.number })).toHaveAttribute(
      "href",
      INVENTORY_ROUTES.adjustment(fixture.adjustmentId),
    );
    expect(screen.getByRole("cell", { name: "Chờ duyệt" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: INVENTORY_LABELS.createAdjustment }),
    ).toBeInTheDocument();
  });

  it("planner sees no create action", async () => {
    setInventoryTestActor("Inventory Planner");
    server.use(
      http.get(endpoint, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [],
            page: 0,
            size: 15,
            totalElements: 0,
            totalPages: 0,
            hasNext: false,
            hasPrevious: false,
          },
        }),
      ),
    );
    renderInventory(<AdjustmentList />);
    await screen.findByText(INVENTORY_LABELS.noAdjustments);
    expect(
      screen.queryByRole("link", { name: INVENTORY_LABELS.createAdjustment }),
    ).not.toBeInTheDocument();
  });
});
