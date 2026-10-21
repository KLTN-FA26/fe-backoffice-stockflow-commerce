import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_PERMISSIONS } from "@/constants";
import { INVENTORY_LABELS, INVENTORY_ROUTES } from "@/constants/inventory";

import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import { ThemeProvider } from "@/components/theme-provider";

import { BackofficeShell } from "./BackofficeShell";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { RoleName } from "@/lib/auth/roles";

const navigation = vi.hoisted(() => ({ pathname: "/admin" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const ADJUSTMENTS = "Điều chỉnh tồn";
const MOVEMENTS = "Lịch sử biến động";
const MOVES = "Di chuyển nội bộ";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  navigation.pathname = "/admin";
});

async function renderShell(
  permissions: readonly PermissionCode[],
  role: RoleName = "Warehouse Staff",
) {
  vi.spyOn(api, "get").mockImplementation(async (url: string) => {
    if (url === "/identity/me/permissions") {
      return { data: { roles: [role], permissions: [...permissions], dataScope: "ALL" } };
    }
    throw new Error(`Unexpected GET ${url}`);
  });
  useAuthStore.setState({
    user: {
      userId: crypto.randomUUID(),
      fullName: "Test actor",
      email: "actor@example.test",
      roles: [role],
      username: "actor",
      status: "ACTIVE",
      lastLoginAt: null,
    },
    status: "authenticated",
    isAuthenticated: true,
    impersonatedRole: null,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <BackofficeShell>
          <p>content</p>
        </BackofficeShell>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(
      client
        .getQueryCache()
        .getAll()
        .some((query) => query.state.status === "success"),
    ).toBe(true),
  );
}

// Sidebar only — sub-pages also show the parent menu as a breadcrumb link.
function navLink(name: string) {
  const sidebar = document.querySelector<HTMLElement>('[data-sidebar="content"]');
  if (!sidebar) throw new Error("Sidebar content not rendered");
  return within(sidebar).queryByRole("link", { name });
}

describe("Inventory sidebar entries follow backend permission codes", () => {
  it.each([
    [[INVENTORY_PERMISSIONS.adjustmentRead, INVENTORY_PERMISSIONS.movementRead], true, true],
    [[INVENTORY_PERMISSIONS.adjustmentRead], true, false],
    [[INVENTORY_PERMISSIONS.movementRead], false, true],
    [[], false, false],
  ] as const)("%j → adjustments %s, movements %s", async (permissions, adjustments, movements) => {
    await renderShell(permissions);
    expect(Boolean(navLink(ADJUSTMENTS))).toBe(adjustments);
    expect(Boolean(navLink(MOVEMENTS))).toBe(movements);
  });

  it("links to the canonical Inventory routes", async () => {
    await renderShell([INVENTORY_PERMISSIONS.adjustmentRead, INVENTORY_PERMISSIONS.movementRead]);
    expect(navLink(ADJUSTMENTS)).toHaveAttribute("href", INVENTORY_ROUTES.adjustments);
    expect(navLink(MOVEMENTS)).toHaveAttribute("href", INVENTORY_ROUTES.movements);
  });

  it("stock UPDATE alone does not show the adjustment list entry", async () => {
    await renderShell([INVENTORY_PERMISSIONS.stockUpdate, INVENTORY_PERMISSIONS.adjustmentApprove]);
    expect(navLink(ADJUSTMENTS)).not.toBeInTheDocument();
  });

  it.each<RoleName>(["System Admin", "Warehouse Manager"])(
    "%s without Inventory READ codes sees no Inventory entry",
    async (role) => {
      await renderShell([], role);
      expect(navLink(ADJUSTMENTS)).not.toBeInTheDocument();
      expect(navLink(MOVEMENTS)).not.toBeInTheDocument();
    },
  );

  it("a non-allowlisted role with movement READ sees Movement History", async () => {
    await renderShell([INVENTORY_PERMISSIONS.movementRead], "Accountant");
    expect(navLink(MOVEMENTS)).toBeInTheDocument();
  });

  it.each([
    INVENTORY_ROUTES.adjustments,
    INVENTORY_ROUTES.createAdjustment,
    INVENTORY_ROUTES.adjustment("d0000001-0000-4000-8000-000000000009"),
  ])("marks only the adjustment entry active on %s", async (pathname) => {
    navigation.pathname = pathname;
    await renderShell([
      INVENTORY_PERMISSIONS.adjustmentRead,
      INVENTORY_PERMISSIONS.movementRead,
      INVENTORY_PERMISSIONS.stockRead,
    ]);
    expect(navLink(INVENTORY_LABELS.overviewTitle)).not.toHaveAttribute("data-active", "true");
    expect(navLink(ADJUSTMENTS)).toHaveAttribute("data-active", "true");
    expect(navLink(MOVEMENTS)).not.toHaveAttribute("data-active", "true");
  });

  it("marks only Movement History active on its route", async () => {
    navigation.pathname = INVENTORY_ROUTES.movements;
    await renderShell([
      INVENTORY_PERMISSIONS.adjustmentRead,
      INVENTORY_PERMISSIONS.movementRead,
      INVENTORY_PERMISSIONS.stockUpdate,
    ]);
    expect(navLink(MOVEMENTS)).toHaveAttribute("data-active", "true");
    expect(navLink(ADJUSTMENTS)).not.toHaveAttribute("data-active", "true");
    expect(navLink(MOVES)).not.toHaveAttribute("data-active", "true");
  });

  it("Di chuyển nội bộ follows the backend guard of POST /inventory/movements (stock UPDATE)", async () => {
    await renderShell([INVENTORY_PERMISSIONS.movementRead, INVENTORY_PERMISSIONS.adjustmentRead]);
    expect(navLink(MOVES)).not.toBeInTheDocument();
    cleanup();
    await renderShell([INVENTORY_PERMISSIONS.stockUpdate]);
    expect(navLink(MOVES)).toHaveAttribute("href", "/admin/moves");
  });

  it("marks only Di chuyển nội bộ active on /admin/moves", async () => {
    navigation.pathname = "/admin/moves";
    await renderShell([INVENTORY_PERMISSIONS.stockUpdate, INVENTORY_PERMISSIONS.movementRead]);
    expect(navLink(MOVES)).toHaveAttribute("data-active", "true");
    expect(navLink(MOVEMENTS)).not.toHaveAttribute("data-active", "true");
  });
});

describe("shell shows no demo data against the real backend", () => {
  it("has no mock-only entries, no warning badges and no mock warehouse switcher", async () => {
    await renderShell([]);
    for (const name of ["Hoá đơn NCC", "Đề xuất nhập hàng", "Xếp xe & bàn giao"]) {
      expect(navLink(name)).not.toBeInTheDocument();
    }
    expect(document.querySelector('[data-sidebar="menu-badge"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Tất cả kho" })).not.toBeInTheDocument();
  });
});
