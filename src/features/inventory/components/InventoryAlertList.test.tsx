import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { INVENTORY_ERROR_MESSAGES, INVENTORY_LABELS } from "@/constants/inventory";
import { INVENTORY_OVERVIEW_PERMISSIONS } from "@/constants/permissions";

import {
  inventoryEndpoint,
  inventoryPermissions,
  overviewAlert,
  overviewPage,
  renderInventory,
  setInventoryTestActor,
} from "../test-support";
import { InventoryAlertList } from "./InventoryAlertList";

import type { PermissionCode } from "@/lib/auth";

// MSW stands in for StockAlertController (GET /inventory/alerts, BE develop cf79223). This proves
// the request the page sends and how it renders the contract shape — not a live backend.
const { alertRead, alertViewPage } = INVENTORY_OVERVIEW_PERMISSIONS;
const WAREHOUSE = "0e380000-0000-4000-8000-0000000000a1";
const server = setupServer();
const sent: URL[] = [];
const alertRequests = () => sent.filter((url) => url.pathname.endsWith("/inventory/alerts"));

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  server.events.on("request:start", ({ request }) => {
    sent.push(new URL(request.url));
  });
});
beforeEach(() => setInventoryTestActor("Warehouse Manager"));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sent.length = 0;
});
afterAll(() => server.close());

function open(
  searchParams: string,
  answer: () => Response = () => HttpResponse.json({ success: true, data: overviewPage([]) }),
  permissions: PermissionCode[] = [alertViewPage, alertRead],
) {
  server.use(
    inventoryPermissions(permissions),
    http.get(inventoryEndpoint("/inventory/alerts"), answer),
  );
  renderInventory(<InventoryAlertList />, searchParams);
}

describe("Inventory alerts page — notification deep link (SCRUM-147)", () => {
  it("applies the BE deep link kind + warehouseId and lists live alerts", async () => {
    const alert = overviewAlert("EXPIRED", {
      warehouseId: WAREHOUSE,
      warehouseCode: "HN01",
      lotNumber: "L2602",
      expiryDate: "2026-10-10",
      daysToExpiry: -5,
    });
    open(`?kind=EXPIRED&warehouseId=${WAREHOUSE}`, () =>
      HttpResponse.json({ success: true, data: overviewPage([alert]) }),
    );
    expect(await screen.findByText("L2602")).toBeInTheDocument();
    expect(screen.getByText("HN01")).toBeInTheDocument();
    const [request] = alertRequests();
    expect(request?.searchParams.get("kind")).toBe("EXPIRED");
    expect(request?.searchParams.get("warehouseId")).toBe(WAREHOUSE);
    expect(request?.searchParams.get("status")).toBe("OPEN,ACKNOWLEDGED");
    expect(request?.searchParams.get("page")).toBe("0");
    expect(screen.queryByText(INVENTORY_LABELS.alertInvalidLink)).toBeNull();
  });

  it.each([
    ["unknown kind", "?kind=DROP_TABLE"],
    ["lower-case kind", "?kind=expired"],
    ["path traversal warehouse", "?kind=SAFETY&warehouseId=..%2F..%2Fadmin"],
    ["oversized warehouse", `?warehouseId=${"a".repeat(65)}`],
  ])("drops a malformed parameter (%s), says so and never sends it", async (_, search) => {
    open(search);
    expect(await screen.findByRole("alert")).toHaveTextContent(INVENTORY_LABELS.alertInvalidLink);
    await waitFor(() => expect(alertRequests()).toHaveLength(1));
    const [request] = alertRequests();
    const kind = request?.searchParams.get("kind");
    expect(kind === null || kind === "SAFETY").toBe(true);
    expect(request?.searchParams.get("warehouseId")).toBeNull();
  });

  it("a warehouse outside the caller's scope shows the out-of-scope message", async () => {
    open(`?kind=EXPIRING&warehouseId=${WAREHOUSE}`, () =>
      HttpResponse.json(
        { success: false, errorCode: "OUT_OF_DATA_SCOPE", message: "forbidden" },
        { status: 403 },
      ),
    );
    expect(await screen.findByText(INVENTORY_ERROR_MESSAGES.outOfScope)).toBeInTheDocument();
  });

  it("a server failure is recoverable with retry", async () => {
    let fail = true;
    open("?kind=REORDER", () =>
      fail
        ? HttpResponse.json(
            { success: false, errorCode: "INTERNAL_ERROR", message: "boom" },
            { status: 500 },
          )
        : HttpResponse.json({ success: true, data: overviewPage([overviewAlert("REORDER")]) }),
    );
    const retry = await screen.findByRole("button", { name: INVENTORY_LABELS.retry });
    fail = false;
    await userEvent.setup().click(retry);
    expect(await screen.findByText("CUP-PP-500")).toBeInTheDocument();
  });

  it("filtered with no match offers to clear the filter; unfiltered says there is no alert", async () => {
    open("?kind=SAFETY");
    expect(await screen.findByText(INVENTORY_LABELS.noResults)).toBeInTheDocument();
    cleanup();
    open("");
    expect(await screen.findByText(INVENTORY_LABELS.noAlerts)).toBeInTheDocument();
  });

  it.each([
    ["READ without VIEW_PAGE", [alertRead]],
    ["VIEW_PAGE without READ", [alertViewPage]],
  ] as const)("%s: denied, no alert request", async (_, permissions) => {
    open("?kind=REORDER", undefined, [...permissions]);
    expect(await screen.findByText(INVENTORY_LABELS.denied)).toBeInTheDocument();
    expect(alertRequests()).toEqual([]);
  });
});
