import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { REPORTING_API, REPORTING_LABELS } from "@/constants/reporting";
import { REPORTING_PERMISSIONS } from "@/constants/permissions";
import { pickDate } from "@/test/date-picker";

import {
  dashboardEndpoint,
  dashboardPermissions,
  signInDashboardActor,
} from "@/features/dashboard/test-support";

import { SalesSection } from "./SalesSection";

import type { PermissionCode } from "@/lib/auth";

// Charts are exercised by the browser, not jsdom (ResponsiveContainer has no size here).
vi.mock("next/dynamic", () => ({
  default: () => {
    const Stub = () => <div data-testid="chart" />;
    return Stub;
  },
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/shared/Toast", () => ({ toast }));

const L = REPORTING_LABELS;
const READ = REPORTING_PERMISSIONS.read as PermissionCode;
const EXPORT = REPORTING_PERMISSIONS.export as PermissionCode;

const PERIOD = { ordersCount: 4, revenue: 5_000_000, averageOrderValue: 1_250_000 };
const SUMMARY = {
  from: "2026-10-01",
  to: "2026-10-07",
  previousFrom: "2026-09-24",
  previousTo: "2026-09-30",
  currency: "VND",
  current: PERIOD,
  previous: PERIOD,
  revenueChangePercent: 25,
};
const DAILY = [{ day: "2026-10-01", ordersCount: 4, revenue: 5_000_000, currency: "VND" }];
const TOP = [
  { sku: "SKU-A", productName: "Áo thun", quantitySold: 7, revenue: 3_000_000 },
  { sku: "SKU-B", quantitySold: 2, revenue: 900_000 },
];
const STATUSES = [
  { status: "ON_HOLD", count: 0 },
  { status: "CONFIRMED", count: 3 },
];

const ok = (data: unknown) => HttpResponse.json({ success: true, data });
const requests: URL[] = [];
const server = setupServer();

function reportRoutes(overrides: Partial<Record<keyof typeof REPORTING_API, () => Response>> = {}) {
  const track = (key: keyof typeof REPORTING_API, data: unknown) =>
    http[key === "rebuild" ? "post" : "get"](
      dashboardEndpoint(REPORTING_API[key]),
      ({ request }) => {
        requests.push(new URL(request.url));
        return overrides[key]?.() ?? ok(data);
      },
    );
  return [
    track("salesDaily", DAILY),
    track("topProducts", TOP),
    track("orderStatusCounts", STATUSES),
    track("summary", SUMMARY),
    track("rebuild", {
      from: "2026-10-01",
      to: "2026-10-07",
      days: 7,
      ordersSeen: 5,
      ordersCounted: 4,
    }),
  ];
}

function renderSection(permissions: PermissionCode[], searchParams = "") {
  server.use(dashboardPermissions(permissions), ...reportRoutes());
  return renderWith(searchParams);
}
function renderWith(searchParams: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={searchParams}>
        <SalesSection />
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  signInDashboardActor();
  requests.length = 0;
  toast.success.mockClear();
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe("sales section — permission gating (UI-only; BE re-checks)", () => {
  it("is absent without reporting-reports:READ and sends no report request", async () => {
    // onUnhandledRequest: "error" — any /reports call would fail this test.
    server.use(dashboardPermissions([]));
    const { container } = renderWith("");
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(L.title)).toBeNull();
    expect(container).toBeEmptyDOMElement();
    expect(requests).toHaveLength(0);
  });

  it("READ shows the section but not the rebuild action", async () => {
    renderSection([READ]);
    expect(await screen.findByText(L.title)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.rebuild })).toBeNull();
  });

  it("EXPORT shows rebuild; confirming posts the range and toasts the result", async () => {
    renderSection([READ, EXPORT], "?salesFrom=2026-10-01&salesTo=2026-10-07");
    fireEvent.click(await screen.findByRole("button", { name: L.rebuild }));
    expect(requests.some((u) => u.pathname.endsWith("/rebuild"))).toBe(false); // confirm step first
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: L.rebuildConfirm }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(L.rebuildDone(7, 4, 5)));
    const post = requests.find((u) => u.pathname.endsWith("/rebuild"));
    expect(post?.searchParams.get("from")).toBe("2026-10-01");
    expect(post?.searchParams.get("to")).toBe("2026-10-07");
  });
});

describe("sales section — data", () => {
  it("renders summary cards (hiding absent %), top SKUs with name fallback and charts", async () => {
    renderSection([READ], "?salesFrom=2026-10-01&salesTo=2026-10-07");
    // % ngắn hiện cạnh nhãn; "so với kỳ trước" là tooltip (title)
    expect(await screen.findByText("+25,0%")).toHaveAttribute("title", L.changeVsPrevious);
    // only revenue carried a change percent
    expect(screen.getAllByTitle(L.changeVsPrevious)).toHaveLength(1);
    expect(screen.getByText("Áo thun")).toBeInTheDocument();
    // SKU-B has no name: the SKU is shown in both columns
    expect(screen.getAllByText("SKU-B")).toHaveLength(2);
    await waitFor(() => expect(screen.getAllByTestId("chart")).toHaveLength(2));
  });

  it("sends the URL range to the range-bound endpoints", async () => {
    renderSection([READ], "?salesFrom=2026-10-01&salesTo=2026-10-07");
    await screen.findByText("Áo thun");
    const daily = requests.find((u) => u.pathname.endsWith("/sales-daily"));
    expect(daily?.searchParams.get("from")).toBe("2026-10-01");
    expect(daily?.searchParams.get("to")).toBe("2026-10-07");
    expect(
      requests.find((u) => u.pathname.endsWith("/top-products"))?.searchParams.get("limit"),
    ).toBe("10");
  });

  it("an invalid custom range is not applied", async () => {
    const user = userEvent.setup();
    renderSection([READ]);
    await pickDate(user, await screen.findByLabelText(L.from), "2026-10-10");
    await pickDate(user, screen.getByLabelText(L.to), "2026-10-01");
    expect(screen.getByRole("alert")).toHaveTextContent(L.rangeReversed);
    expect(screen.getByRole("button", { name: L.apply })).toBeDisabled();
  }, 20_000);

  it("shows the empty state for a range without orders", async () => {
    server.use(
      dashboardPermissions([READ]),
      ...reportRoutes({
        salesDaily: () => ok([{ day: "2026-10-01", ordersCount: 0, revenue: 0, currency: "VND" }]),
        topProducts: () => ok([]),
        orderStatusCounts: () => ok([{ status: "ON_HOLD", count: 0 }]),
      }),
    );
    renderWith("");
    await waitFor(() => expect(screen.getAllByText(L.emptyTitle)).toHaveLength(3));
  });

  it("shows an error with retry when a widget fails", async () => {
    server.use(
      dashboardPermissions([READ]),
      ...reportRoutes({
        topProducts: () =>
          HttpResponse.json({ success: false, errorCode: "X", message: "boom" }, { status: 500 }),
      }),
    );
    renderWith("");
    const retry = await screen.findByRole("button", { name: L.retry });
    expect(retry).toBeInTheDocument();
  });
});
