import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";
import { INVENTORY_LABELS, INVENTORY_ROUTES } from "@/constants/inventory";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";
import { STOCK_ADJUSTMENT_STATUS } from "@/constants/statuses";

import { installInventoryTestApiContract } from "../test-api-contract";
import {
  adjustmentFixture,
  inventoryEndpoint,
  inventoryPermissions,
  renderInventory,
  setInventoryTestActor,
} from "../test-support";
import { AdjustmentList } from "./AdjustmentList";

const server = setupServer();
let restoreApiContract: () => void;
const endpoint = "http://localhost/api/v1/inventory/adjustments";
const emptyPage = {
  items: [],
  page: 0,
  size: 15,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
};
const { adjustmentRead, stockUpdate } = INVENTORY_PERMISSIONS;
beforeAll(() => {
  restoreApiContract = installInventoryTestApiContract();
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
  restoreApiContract();
});

function emptyList() {
  return http.get(endpoint, () => HttpResponse.json({ success: true, data: emptyPage }));
}

describe("adjustment queue", () => {
  it("loads the URL approval queue and links its detail", async () => {
    const fixture = adjustmentFixture();
    server.use(
      inventoryPermissions([adjustmentRead, stockUpdate]),
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

  it("READ without stock UPDATE sees no create action", async () => {
    setInventoryTestActor("Inventory Planner");
    server.use(inventoryPermissions([adjustmentRead]), emptyList());
    renderInventory(<AdjustmentList />);
    await screen.findByText(INVENTORY_LABELS.noAdjustments);
    expect(
      screen.queryByRole("link", { name: INVENTORY_LABELS.createAdjustment }),
    ).not.toBeInTheDocument();
  });

  it("a formerly privileged role without UPDATE gets no create action", async () => {
    setInventoryTestActor("System Admin");
    server.use(inventoryPermissions([adjustmentRead], ["SYSTEM_ADMIN"]), emptyList());
    renderInventory(<AdjustmentList />);
    await screen.findByText(INVENTORY_LABELS.noAdjustments);
    expect(
      screen.queryByRole("link", { name: INVENTORY_LABELS.createAdjustment }),
    ).not.toBeInTheDocument();
  });

  it("a non-allowlisted role with READ and UPDATE can open the queue and create", async () => {
    setInventoryTestActor("Accountant");
    server.use(inventoryPermissions([adjustmentRead, stockUpdate], ["ACCOUNTANT"]), emptyList());
    renderInventory(<AdjustmentList />);
    await screen.findByText(INVENTORY_LABELS.noAdjustments);
    expect(
      screen.getAllByRole("link", { name: INVENTORY_LABELS.createAdjustment }).length,
    ).toBeGreaterThan(0);
  });

  it("a formerly privileged role without adjustment READ is denied and nothing is fetched", async () => {
    const listed = vi.fn();
    server.use(
      inventoryPermissions([stockUpdate], ["WAREHOUSE_MANAGER"]),
      http.get(endpoint, () => {
        listed();
        return HttpResponse.json({ success: true, data: emptyPage });
      }),
    );
    renderInventory(<AdjustmentList />);
    expect(await screen.findByText(INVENTORY_LABELS.denied)).toBeInTheDocument();
    expect(screen.queryByText(INVENTORY_LABELS.adjustmentTitle)).not.toBeInTheDocument();
    expect(listed).not.toHaveBeenCalled();
  });

  it("shows nothing protected while permissions load and recovers after a permission error", async () => {
    let attempts = 0;
    server.use(
      http.get(inventoryEndpoint("/identity/me/permissions"), () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json({ success: false, errorCode: "SERVER_ERROR" }, { status: 500 })
          : HttpResponse.json({
              success: true,
              data: { roles: ["TEST"], permissions: [adjustmentRead], dataScope: "ALL" },
            });
      }),
      emptyList(),
    );
    renderInventory(<AdjustmentList />);
    expect(screen.queryByText(INVENTORY_LABELS.adjustmentTitle)).not.toBeInTheDocument();
    expect(await screen.findByText(UI_LABELS.loadError.permissionsTitle)).toBeInTheDocument();
    expect(screen.queryByText(INVENTORY_LABELS.adjustmentTitle)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: INVENTORY_LABELS.retry }));
    expect(await screen.findByText(INVENTORY_LABELS.noAdjustments)).toBeInTheDocument();
  });

  it("keeps a row with unknown backend reason/status visible", async () => {
    const fixture = adjustmentFixture({ reason: "COUNT_VARIANCE", status: "APPROVED" });
    server.use(
      inventoryPermissions([adjustmentRead]),
      http.get(endpoint, () =>
        HttpResponse.json({
          success: true,
          data: { ...emptyPage, items: [fixture], totalElements: 1, totalPages: 1 },
        }),
      ),
    );
    renderInventory(<AdjustmentList />);
    expect(await screen.findByRole("link", { name: fixture.number })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "COUNT_VARIANCE" })).toBeInTheDocument();
    expect(screen.getByTitle(/APPROVED/)).toBeInTheDocument();
  });
});
