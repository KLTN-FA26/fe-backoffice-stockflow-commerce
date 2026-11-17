import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DASHBOARD_API, DASHBOARD_LABELS } from "@/constants/dashboard";
import { ADMIN_ROUTES } from "@/constants/routes";
import {
  FULFILLMENT_PICK_PERMISSIONS,
  GOODS_RECEIPT_PERMISSIONS,
  ORDER_PERMISSIONS,
} from "@/constants/permissions";

import {
  countPage,
  dashboardEndpoint,
  dashboardPermissions,
  renderDashboard,
  signInDashboardActor,
} from "../test-support";
import { DashboardKpis } from "./DashboardKpis";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => signInDashboardActor());
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function tile(label: string) {
  return screen.getByText(label).closest("a, div[title]") as HTMLElement;
}

describe("KPI tiles — real list endpoints, gated by the endpoint's own permission", () => {
  it("shows only the tiles the user may read, with the BE counts and the right filters", async () => {
    const seen: Record<string, URLSearchParams> = {};
    server.use(
      dashboardPermissions([ORDER_PERMISSIONS.read]),
      http.get(dashboardEndpoint(DASHBOARD_API.orders), ({ request }) => {
        seen.orders = new URL(request.url).searchParams;
        return countPage(7);
      }),
    );
    renderDashboard(<DashboardKpis />);
    await waitFor(() =>
      expect(within(tile(DASHBOARD_LABELS.ordersPending)).getByText("7")).toBeInTheDocument(),
    );
    expect(screen.queryByText(DASHBOARD_LABELS.receiptsProcessing)).not.toBeInTheDocument();
    expect(screen.queryByText(DASHBOARD_LABELS.picksOpen)).not.toBeInTheDocument();
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

  it("receipts use their processing statuses", async () => {
    const seen: Record<string, string[]> = {};
    server.use(
      dashboardPermissions([GOODS_RECEIPT_PERMISSIONS.read]),
      http.get(dashboardEndpoint(DASHBOARD_API.receipts), ({ request }) => {
        seen.receipts = new URL(request.url).searchParams.getAll("status");
        return countPage(5);
      }),
    );
    renderDashboard(<DashboardKpis />);
    await waitFor(() =>
      expect(within(tile(DASHBOARD_LABELS.receiptsProcessing)).getByText("5")).toBeInTheDocument(),
    );
    expect(seen.receipts).toEqual([
      "DRAFT",
      "PENDING_APPROVAL",
      "CONFIRMED",
      "IN_QC",
      "IN_PUTAWAY",
    ]);
  });

  it("a failing endpoint shows an em dash, never a number; the other tiles are unaffected", async () => {
    server.use(
      dashboardPermissions([ORDER_PERMISSIONS.read, GOODS_RECEIPT_PERMISSIONS.read]),
      http.get(dashboardEndpoint(DASHBOARD_API.orders), () =>
        HttpResponse.json(
          { success: false, errorCode: "INTERNAL_ERROR", message: "x" },
          { status: 500 },
        ),
      ),
      http.get(dashboardEndpoint(DASHBOARD_API.receipts), () => countPage(0)),
    );
    renderDashboard(<DashboardKpis />);
    await waitFor(() =>
      expect(
        within(tile(DASHBOARD_LABELS.ordersPending)).getByText(DASHBOARD_LABELS.unavailable),
      ).toBeInTheDocument(),
    );
    // Lý do nằm ở tooltip của ô, không thêm dòng chữ
    expect(tile(DASHBOARD_LABELS.ordersPending)).toHaveAttribute(
      "title",
      DASHBOARD_LABELS.unavailableHint,
    );
    await waitFor(() =>
      expect(within(tile(DASHBOARD_LABELS.receiptsProcessing)).getByText("0")).toBeInTheDocument(),
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
