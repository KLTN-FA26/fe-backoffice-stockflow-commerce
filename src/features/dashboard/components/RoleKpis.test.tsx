import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ROLE_DASHBOARD_LABELS as L } from "@/constants/dashboard";
import { UI_LABELS } from "@/constants/labels";

import {
  countPage,
  dashboardEndpoint,
  dashboardPermissions,
  renderDashboard,
  signInDashboardActor,
} from "../test-support";
import { fetchExpiringQuotes } from "../role-api";
import { RoleKpis } from "./RoleKpis";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => signInDashboardActor());
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

const tile = (label: string) => screen.getByText(label).closest("a") as HTMLElement;
const DAY = 86_400_000;

function quotesPage(validUntil: readonly string[]) {
  return HttpResponse.json({
    success: true,
    data: {
      items: validUntil.map((value, index) => ({ id: `q-${index}`, validUntil: value })),
      page: 0,
      size: 100,
      totalElements: validUntil.length,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  });
}

describe("Việc của bạn — bảng điều khiển theo vai trò (L-12)", () => {
  it("Sale: yêu cầu báo giá mới (đơn lẻ + dự án OPEN), báo giá sắp hết hạn, chat chưa đọc", async () => {
    const now = Date.now();
    const seen: URLSearchParams[] = [];
    server.use(
      dashboardPermissions([
        "design-quote-requests:READ",
        "sales-quotes:READ",
        "chat-conversations:READ",
        // Sale đọc được đợt nhưng không lập phiếu thu → không có ô của Kế toán
        "payment-installments:READ",
      ]),
      http.get(dashboardEndpoint("/design-quote-requests"), ({ request }) => {
        seen.push(new URL(request.url).searchParams);
        return countPage(3);
      }),
      http.get(dashboardEndpoint("/design-project-quote-requests"), () => countPage(2)),
      http.get(dashboardEndpoint("/quotes"), () =>
        quotesPage([
          new Date(now - DAY).toISOString(), // đã quá hạn: không đếm
          new Date(now + DAY).toISOString(),
          new Date(now + 2 * DAY).toISOString(),
          new Date(now + 10 * DAY).toISOString(),
        ]),
      ),
    );
    renderDashboard(<RoleKpis unreadChats={4} />);
    await waitFor(() =>
      expect(within(tile(L.newQuoteRequests)).getByText("5")).toBeInTheDocument(),
    );
    expect(seen[0]?.get("status")).toBe("OPEN");
    await waitFor(() => expect(within(tile(L.expiringQuotes)).getByText("2")).toBeInTheDocument());
    expect(tile(L.expiringQuotes)).toHaveAttribute(
      "href",
      "/admin/quotes?status=SENT&sort=validUntil,asc",
    );
    expect(within(tile(L.unreadChats)).getByText("4")).toBeInTheDocument();
    expect(screen.queryByText(L.installmentsOwing)).not.toBeInTheDocument();
  });

  it("Kế toán: đợt đến hạn chưa thu (owing=true) và quá hạn (overdue=true), dẫn tới danh sách đã lọc", async () => {
    const seen: URLSearchParams[] = [];
    server.use(
      dashboardPermissions(["payment-installments:READ", "payment-receipts:CREATE"]),
      http.get(dashboardEndpoint("/installments"), ({ request }) => {
        const params = new URL(request.url).searchParams;
        seen.push(params);
        return countPage(params.get("overdue") === "true" ? 2 : 9);
      }),
    );
    renderDashboard(<RoleKpis />);
    await waitFor(() =>
      expect(within(tile(L.installmentsOwing)).getByText("9")).toBeInTheDocument(),
    );
    expect(within(tile(L.installmentsOverdue)).getByText("2")).toBeInTheDocument();
    expect(tile(L.installmentsOwing)).toHaveAttribute(
      "href",
      "/admin/payment/installments?owing=true",
    );
    expect(tile(L.installmentsOverdue)).toHaveAttribute(
      "href",
      "/admin/payment/installments?owing=true&overdue=true",
    );
    expect(seen.every((params) => params.get("owing") === "true")).toBe(true);
    expect(screen.queryByText(L.newQuoteRequests)).not.toBeInTheDocument();
  });

  it("FLOW-1: Kế toán (duyệt công nợ) thấy số đơn chờ duyệt công nợ, dẫn tới hàng đợi", async () => {
    const seen: URLSearchParams[] = [];
    server.use(
      dashboardPermissions(["sales-order-credit-holds:READ", "sales-order-credit-holds:APPROVE"]),
      http.get(dashboardEndpoint("/orders/credit-holds"), ({ request }) => {
        seen.push(new URL(request.url).searchParams);
        return countPage(3);
      }),
    );
    renderDashboard(<RoleKpis />);
    await waitFor(() => expect(within(tile(L.creditHolds)).getByText("3")).toBeInTheDocument());
    expect(tile(L.creditHolds)).toHaveAttribute("href", "/admin/orders/credit-holds");
    // The tile is named like the queue page it opens.
    expect(L.creditHolds).toBe(UI_LABELS.order.creditHoldsTitle);
    expect(seen[0]?.get("size")).toBe("1");
  });

  it("FLOW-1: chỉ xem hàng đợi (READ, không APPROVE) → không có ô đơn chờ duyệt", async () => {
    server.use(dashboardPermissions(["sales-order-credit-holds:READ", "sales-quotes:READ"]));
    server.use(http.get(dashboardEndpoint("/quotes"), () => quotesPage([])));
    renderDashboard(<RoleKpis />);
    expect(await screen.findByText(L.expiringQuotes)).toBeInTheDocument();
    expect(screen.queryByText(L.creditHolds)).not.toBeInTheDocument();
  });

  it("không quyền nào → không hiện hàng 'Việc của bạn'", async () => {
    server.use(dashboardPermissions([]));
    renderDashboard(<RoleKpis />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(L.title)).not.toBeInTheDocument();
  });

  it("trang báo giá đầy mà mục cuối vẫn trong cửa sổ → số là 'ít nhất' (truncated)", async () => {
    const now = Date.parse("2026-11-23T00:00:00Z");
    server.use(
      http.get(dashboardEndpoint("/quotes"), () =>
        quotesPage(Array.from({ length: 100 }, () => new Date(now + DAY).toISOString())),
      ),
    );
    expect(await fetchExpiringQuotes(3, now)).toEqual({ count: 100, truncated: true });
  });
});
