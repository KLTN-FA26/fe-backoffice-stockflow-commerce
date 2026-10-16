import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_LABELS } from "@/constants/inventory";
import {
  IDENTITY_PERMISSIONS,
  INVENTORY_OVERVIEW_PERMISSIONS,
  SHIPMENT_PERMISSIONS,
  SUPPLIER_PERMISSIONS,
} from "@/constants/permissions";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";
import { meKeys } from "@/lib/auth/me-permissions";

import { NAV_GROUPS, useCanSeeNavItem } from "./BackofficeShell";

const mockMode = vi.hoisted(() => ({ isMock: false }));
vi.mock("@/providers/app-providers", () => ({ useIsMock: () => mockMode.isMock }));

function Navigation() {
  const canSee = useCanSeeNavItem();
  return (
    <nav>
      {NAV_GROUPS.flatMap((group) => group.items)
        .filter(canSee)
        .map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
    </nav>
  );
}
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.getState().login(
    {
      userId: "nav-user",
      username: "staff",
      fullName: null,
      email: "staff@example.com",
      roles: ["ROLE_SYSTEM_ADMIN"],
      status: "ACTIVE",
      lastLoginAt: null,
    },
    false,
  );
});
afterEach(() => {
  cleanup();
  client.clear();
  useAuthStore.getState().logout(false);
  vi.restoreAllMocks();
});
const mount = () =>
  render(
    <QueryClientProvider client={client}>
      <Navigation />
    </QueryClientProvider>,
  );

describe("declared navigation permissions", () => {
  it("does not flash gated navigation while unresolved; ungated items remain visible", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions: [SUPPLIER_PERMISSIONS.viewPage], dataScope: "ALL" },
    });
    mount();
    for (const name of ["Nhà cung cấp", "Đơn đặt NCC", "Đơn hàng", "Phân quyền"])
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tổng quan" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sản phẩm & SKU" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Nhà cung cấp" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Đơn đặt NCC" })).not.toBeInTheDocument();
  });
  it("query errors hide required entries without hiding ungated entries", async () => {
    vi.spyOn(api, "get").mockRejectedValue(new ApiError(503, "UNAVAILABLE", "Unavailable"));
    mount();
    await waitFor(() =>
      expect(
        client.getQueryState(
          meKeys.sessionPermissions("nav-user", useAuthStore.getState().authorizationVersion),
        )?.status,
      ).toBe("error"),
    );
    expect(screen.queryByRole("link", { name: "Nhà cung cấp" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tổng quan" })).toBeInTheDocument();
  });
  it.each([
    ["stock READ", [INVENTORY_OVERVIEW_PERMISSIONS.stockRead], true],
    ["reservation READ", [INVENTORY_OVERVIEW_PERMISSIONS.reservationRead], true],
    ["alert READ alone", [INVENTORY_OVERVIEW_PERMISSIONS.alertRead], false],
  ] as const)("inventory overview menu with %s → visible: %s", async (_, permissions, visible) => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: {
        roles: [],
        permissions: [...permissions, IDENTITY_PERMISSIONS.rbacRead],
        dataScope: "ALL",
      },
    });
    mount();
    // Wait for the permission answer (the RBAC entry appears), then check the overview entry.
    expect(await screen.findByRole("link", { name: "Phân quyền" })).toBeInTheDocument();
    const link = screen.queryByRole("link", { name: INVENTORY_LABELS.overviewTitle });
    expect(link !== null).toBe(visible);
  });
  it("read-only RBAC navigation uses the real backend READ capability", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions: [IDENTITY_PERMISSIONS.rbacRead], dataScope: "ALL" },
    });
    mount();
    expect(await screen.findByRole("link", { name: "Phân quyền" })).toBeInTheDocument();
  });
  it("màn chỉ chạy trên mock (xếp xe & bàn giao) ẩn khi nối BE thật dù có quyền", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions: [SHIPMENT_PERMISSIONS.viewPage], dataScope: "ALL" },
    });
    mockMode.isMock = false;
    mount();
    expect(await screen.findByRole("link", { name: "Kế hoạch xếp xe" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Xếp xe & bàn giao" })).not.toBeInTheDocument();

    cleanup();
    mockMode.isMock = true;
    mount();
    expect(await screen.findByRole("link", { name: "Xếp xe & bàn giao" })).toBeInTheDocument();
    mockMode.isMock = false;
  });
});
