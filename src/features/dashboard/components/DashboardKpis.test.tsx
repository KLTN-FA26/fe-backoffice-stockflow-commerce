import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DASHBOARD_API, DASHBOARD_LABELS } from "@/constants/dashboard";
import { ADMIN_ROUTES } from "@/constants/routes";
import {
  FULFILLMENT_PICK_PERMISSIONS,
  GOODS_RECEIPT_PERMISSIONS,
  INVENTORY_PERMISSIONS,
  ORDER_PERMISSIONS,
  PO_PERMISSIONS,
  TRANSFER_PERMISSIONS,
} from "@/constants/permissions";

import {
  countPage,
  dashboardEndpoint,
  dashboardPermissions,
  renderDashboard,
  signInDashboardActor,
} from "../test-support";
import { DashboardKpis } from "./DashboardKpis";
import { StockAlertsWidget } from "./StockAlertsWidget";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => signInDashboardActor());
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function tile(label: string) {
  return screen.getByText(label).closest("a, div[class*='min-h']") as HTMLElement;
}

describe("KPI tiles — real list endpoints, gated by the endpoint's own permission", () => {
  it("shows only the tiles the user may read, with the BE counts and the right filters", async () => {
    const seen: Record<string, URLSearchParams> = {};
    server.use(
      dashboardPermissions([ORDER_PERMISSIONS.read, PO_PERMISSIONS.read]),
      http.get(dashboardEndpoint(DASHBOARD_API.orders), ({ request }) => {
        seen.orders = new URL(request.url).searchParams;
        return countPage(7);
      }),
      http.get(dashboardEndpoint(DASHBOARD_API.purchaseOrders), ({ request }) => {
        seen.po = new URL(request.url).searchParams;
        return countPage(2);
      }),
    );
    renderDashboard(<DashboardKpis />);
    await waitFor(() =>
      expect(within(tile(DASHBOARD_LABELS.ordersPending)).getByText("7")).toBeInTheDocument(),
    );
    expect(within(tile(DASHBOARD_LABELS.poPending)).getByText("2")).toBeInTheDocument();
    expect(screen.queryByText(DASHBOARD_LABELS.receiptsProcessing)).not.toBeInTheDocument();
    expect(screen.queryByText(DASHBOARD_LABELS.transfersInTransit)).not.toBeInTheDocument();
    expect(screen.queryByText(DASHBOARD_LABELS.picksOpen)).not.toBeInTheDocument();
    expect(screen.queryByText(DASHBOARD_LABELS.alertsOpen)).not.toBeInTheDocument();
    // BE enum values, repeated key, page of one.
    expect(seen.orders?.getAll("status")).toEqual([
      "PENDING_PAYMENT",
      "CONFIRMED",
      "IN_PRODUCTION",
      "READY_TO_FULFILL",
      "ON_HOLD",
    ]);
    expect(seen.orders?.get("size")).toBe("1");
    // Tile mở danh sách đơn lọc đúng tập trạng thái nó đếm (nhãn FE trên URL, cách nhau bằng dấu phẩy)
    const href =
      screen.getByText(DASHBOARD_LABELS.ordersPending).closest("a")?.getAttribute("href") ?? "";
    expect(href.startsWith(`${ADMIN_ROUTES.orders.list}?status=`)).toBe(true);
    expect(decodeURIComponent(href.split("?status=")[1] ?? "").split(",")).toEqual([
      "Pending Payment",
      "Confirmed",
      "In Production",
      "Ready to Fulfill",
      "On Hold",
    ]);
    expect(seen.po?.getAll("status")).toEqual(["PENDING_APPROVAL"]);
  });

  it("counts pick tasks per status (the BE filters one status at a time) and adds them", async () => {
    server.use(
      dashboardPermissions([FULFILLMENT_PICK_PERMISSIONS.read]),
      http.get(dashboardEndpoint(DASHBOARD_API.pickTasks), ({ request }) => {
        const status = new URL(request.url).searchParams.get("status");
        return countPage(status === "PENDING" ? 3 : status === "PICKING" ? 4 : 99);
      }),
    );
    renderDashboard(<DashboardKpis />);
    await waitFor(() =>
      expect(within(tile(DASHBOARD_LABELS.picksOpen)).getByText("7")).toBeInTheDocument(),
    );
  });

  it("receipts and transfers use their processing / in-transit statuses", async () => {
    const seen: Record<string, string[]> = {};
    server.use(
      dashboardPermissions([GOODS_RECEIPT_PERMISSIONS.read, TRANSFER_PERMISSIONS.read]),
      http.get(dashboardEndpoint(DASHBOARD_API.receipts), ({ request }) => {
        seen.receipts = new URL(request.url).searchParams.getAll("status");
        return countPage(5);
      }),
      http.get(dashboardEndpoint(DASHBOARD_API.transfers), ({ request }) => {
        seen.transfers = new URL(request.url).searchParams.getAll("status");
        return countPage(1);
      }),
    );
    renderDashboard(<DashboardKpis />);
    await waitFor(() =>
      expect(within(tile(DASHBOARD_LABELS.receiptsProcessing)).getByText("5")).toBeInTheDocument(),
    );
    expect(seen.receipts).toEqual(["DRAFT", "CONFIRMED", "IN_QC", "IN_PUTAWAY"]);
    expect(seen.transfers).toEqual(["IN_TRANSIT", "PARTIALLY_RECEIVED"]);
  });

  it("a failing endpoint shows an em dash, never a number; the other tiles are unaffected", async () => {
    server.use(
      dashboardPermissions([ORDER_PERMISSIONS.read, PO_PERMISSIONS.read]),
      http.get(dashboardEndpoint(DASHBOARD_API.orders), () =>
        HttpResponse.json(
          { success: false, errorCode: "INTERNAL_ERROR", message: "x" },
          { status: 500 },
        ),
      ),
      http.get(dashboardEndpoint(DASHBOARD_API.purchaseOrders), () => countPage(0)),
    );
    renderDashboard(<DashboardKpis />);
    await waitFor(() =>
      expect(
        within(tile(DASHBOARD_LABELS.ordersPending)).getByText(DASHBOARD_LABELS.unavailable),
      ).toBeInTheDocument(),
    );
    expect(
      within(tile(DASHBOARD_LABELS.ordersPending)).getByText(DASHBOARD_LABELS.unavailableHint),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(within(tile(DASHBOARD_LABELS.poPending)).getByText("0")).toBeInTheDocument(),
    );
  });

  it("a body that is not a page is a contract failure, shown as unavailable", async () => {
    server.use(
      dashboardPermissions([ORDER_PERMISSIONS.read]),
      http.get(dashboardEndpoint(DASHBOARD_API.orders), () =>
        HttpResponse.json({ success: true, data: { unexpected: true } }),
      ),
    );
    renderDashboard(<DashboardKpis />);
    await waitFor(() =>
      expect(
        within(tile(DASHBOARD_LABELS.ordersPending)).getByText(DASHBOARD_LABELS.unavailable),
      ).toBeInTheDocument(),
    );
  });

  it("renders nothing for a user with none of the permissions (and calls nothing)", async () => {
    server.use(dashboardPermissions([]));
    const { container } = renderDashboard(<DashboardKpis />);
    await waitFor(() => expect(container.querySelector("[aria-busy]")).toBeNull());
    expect(container).toBeEmptyDOMElement();
  });

  it("alert tile sums the open alerts of every kind and names the breakdown", async () => {
    server.use(
      dashboardPermissions([INVENTORY_PERMISSIONS.alertRead]),
      http.get(dashboardEndpoint(DASHBOARD_API.alertSummary), () =>
        HttpResponse.json({
          success: true,
          data: { openByKind: { REORDER: 2, SAFETY: 0, EXPIRING: 3, EXPIRED: 1, FUTURE_KIND: 4 } },
        }),
      ),
    );
    renderDashboard(<DashboardKpis />);
    await waitFor(() =>
      expect(within(tile(DASHBOARD_LABELS.alertsOpen)).getByText("10")).toBeInTheDocument(),
    );
    expect(
      screen.getByText("Đến điểm đặt hàng 2 · Sắp hết hạn 3 · Đã hết hạn 1 · FUTURE_KIND 4"),
    ).toBeInTheDocument();
  });

  it("the permission list failing shows a retryable notice, not guessed tiles", async () => {
    const calls = vi.fn();
    server.use(
      http.get(dashboardEndpoint("/identity/me/permissions"), () => {
        calls();
        return HttpResponse.json(
          { success: false, errorCode: "INTERNAL_ERROR", message: "x" },
          { status: 500 },
        );
      }),
    );
    renderDashboard(<DashboardKpis />);
    expect(await screen.findByText(new RegExp(DASHBOARD_LABELS.permissionsError))).toBeVisible();
    expect(screen.queryByText(DASHBOARD_LABELS.ordersPending)).not.toBeInTheDocument();
  });
});

describe("stock alerts widget", () => {
  const alert = {
    id: crypto.randomUUID(),
    kind: "EXPIRING",
    sku: "CUP-PP-500",
    warehouseCode: "HCM",
    lotNumber: "LOT-7",
    expiryDate: "2026-11-01",
    observedQty: 12,
    status: "OPEN",
    openedAt: "2026-10-18T03:00:00Z",
  };

  it("lists the open alerts (BE order), with 'whole system' for a SKU-level alert", async () => {
    let query: URLSearchParams | undefined;
    server.use(
      dashboardPermissions([INVENTORY_PERMISSIONS.alertRead]),
      http.get(dashboardEndpoint(DASHBOARD_API.alerts), ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json({
          success: true,
          data: {
            items: [
              alert,
              {
                ...alert,
                id: crypto.randomUUID(),
                kind: "REORDER",
                sku: "SOFA-3S-GREY",
                warehouseCode: undefined,
                lotNumber: undefined,
                expiryDate: undefined,
                thresholdQty: 20,
                observedQty: 5,
              },
            ],
            page: 0,
            size: 8,
            totalElements: 11,
            totalPages: 2,
            hasNext: true,
            hasPrevious: false,
          },
        });
      }),
    );
    renderDashboard(<StockAlertsWidget />);
    expect(await screen.findByText("SOFA-3S-GREY")).toBeInTheDocument();
    expect(screen.getByText("Sắp hết hạn")).toBeInTheDocument();
    expect(screen.getByText("Đến điểm đặt hàng")).toBeInTheDocument();
    expect(screen.getByText(DASHBOARD_LABELS.alertAllWarehouses)).toBeInTheDocument();
    expect(screen.getByText("HCM")).toBeInTheDocument();
    expect(screen.getByText(DASHBOARD_LABELS.alertsMore)).toBeInTheDocument();
    expect(query?.get("status")).toBe("OPEN");
    expect(query?.get("size")).toBe("8");
  });

  it("empty state when there is nothing to act on", async () => {
    server.use(
      dashboardPermissions([INVENTORY_PERMISSIONS.alertRead]),
      http.get(dashboardEndpoint(DASHBOARD_API.alerts), () =>
        HttpResponse.json({
          success: true,
          data: { items: [], page: 0, size: 8, totalElements: 0, totalPages: 0 },
        }),
      ),
    );
    renderDashboard(<StockAlertsWidget />);
    expect(await screen.findByText(DASHBOARD_LABELS.alertsEmptyTitle)).toBeInTheDocument();
  });

  it("renders nothing and requests nothing without inventory-alerts:READ", async () => {
    server.use(dashboardPermissions([ORDER_PERMISSIONS.read]));
    const { container } = renderDashboard(<StockAlertsWidget />);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(container).toBeEmptyDOMElement();
  });

  it("a failed load is reported, not hidden", async () => {
    server.use(
      dashboardPermissions([INVENTORY_PERMISSIONS.alertRead]),
      http.get(dashboardEndpoint(DASHBOARD_API.alerts), () =>
        HttpResponse.json(
          { success: false, errorCode: "INTERNAL_ERROR", message: "x" },
          { status: 500 },
        ),
      ),
    );
    renderDashboard(<StockAlertsWidget />);
    expect(await screen.findByText(DASHBOARD_LABELS.alertsLoadError)).toBeInTheDocument();
  });
});
