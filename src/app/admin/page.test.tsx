import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DASHBOARD_LABELS } from "@/constants/dashboard";

import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import AdminDashboardPage from "./page";

const mockMode = vi.hoisted(() => ({ isMock: false }));
vi.mock("@/providers/app-providers", () => ({ useIsMock: () => mockMode.isMock }));

const server = setupServer();
const url = (path: string) =>
  new URL(`${api.defaults.baseURL ?? ""}${path}`, window.location.origin).href;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  mockMode.isMock = false;
  // No permission → no tile and no request: the page's structure is what is under test here.
  server.use(
    http.get(url("/identity/me/permissions"), () =>
      HttpResponse.json({
        success: true,
        data: { roles: ["TEST"], permissions: [], dataScope: "ALL" },
      }),
    ),
  );
  useAuthStore.setState({
    user: {
      userId: crypto.randomUUID(),
      fullName: "Test actor",
      email: "actor@example.test",
      roles: ["Warehouse Manager"],
      username: "actor",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    status: "authenticated",
    isAuthenticated: true,
    impersonatedRole: null,
  });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      {/* The app mounts NuqsAdapter in providers; the sales range lives in the URL. */}
      <NuqsTestingAdapter>
        <AdminDashboardPage />
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

// Widgets whose data exists only in the demo dataset (BE has no endpoint for them).
const MOCK_ONLY_WIDGETS = [
  "Cần xử lý ngay",
  "Hoạt động gần đây",
  "Hiệu suất kho hôm nay",
  "Đề xuất nhập hàng",
];

describe("dashboard — no demo numbers against the real backend", () => {
  it("shows none of the mock-only widgets", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: DASHBOARD_LABELS.title })).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector("[aria-busy]")).toBeNull());
    for (const title of MOCK_ONLY_WIDGETS) {
      expect(screen.queryByText(title)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("link", { name: /Xem tất cả|Xem chi tiết/ })).not.toBeInTheDocument();
    // The numbers of the former mock tiles are gone with their labels.
    expect(screen.queryByText("Vận đơn ngoại lệ")).not.toBeInTheDocument();
    expect(screen.queryByText("Pick cần chú ý")).not.toBeInTheDocument();
  });
});

describe("dashboard — mock mode keeps its demo widgets", () => {
  it("shows every widget, with the replenishment link", async () => {
    mockMode.isMock = true;
    renderPage();
    for (const title of MOCK_ONLY_WIDGETS) {
      expect(await screen.findByText(title)).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: /Xem tất cả/ })).toHaveAttribute(
      "href",
      "/admin/replenishment",
    );
  });
});
