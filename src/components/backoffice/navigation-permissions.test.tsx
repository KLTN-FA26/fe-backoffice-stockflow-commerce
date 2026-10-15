import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import {
  CREDIT_HOLD_PERMISSIONS,
  IDENTITY_PERMISSIONS,
  ORDER_PERMISSIONS,
  SUPPLIER_PERMISSIONS,
} from "@/constants/permissions";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";
import { meKeys } from "@/lib/auth/me-permissions";

import {
  NAV_GROUPS,
  buildBreadcrumbItems,
  findActiveNavHref,
  useCanSeeNavItem,
  visibleNavGroups,
} from "./BackofficeShell";

import type { PermissionCode } from "@/lib/auth/me-permissions";

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
  it("read-only RBAC navigation uses the real backend READ capability", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions: [IDENTITY_PERMISSIONS.rbacRead], dataScope: "ALL" },
    });
    mount();
    expect(await screen.findByRole("link", { name: "Phân quyền" })).toBeInTheDocument();
  });
});

describe("credit hold navigation — gate bằng quyền credit hold, không phụ thuộc trang Đơn hàng", () => {
  const CREDIT_LABEL = UI_LABELS.order.creditHoldsTitle;
  const ORDERS_LABEL = "Đơn hàng";

  function mountWith(permissions: readonly PermissionCode[]) {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions, dataScope: "ALL" },
    });
    mount();
  }

  it("A/B. chỉ có credit-hold VIEW_PAGE (ACCOUNTANT) → thấy mục hàng đợi, KHÔNG thấy 'Đơn hàng'", async () => {
    mountWith([CREDIT_HOLD_PERMISSIONS.viewPage, CREDIT_HOLD_PERMISSIONS.approve]);

    const link = await screen.findByRole("link", { name: CREDIT_LABEL });
    expect(link).toHaveAttribute("href", ADMIN_ROUTES.orders.creditHolds);
    expect(screen.queryByRole("link", { name: ORDERS_LABEL })).not.toBeInTheDocument();
  });

  it("C. có cả hai quyền → thấy cả 'Đơn hàng' lẫn mục hàng đợi, mỗi mục một lần", async () => {
    mountWith([ORDER_PERMISSIONS.viewPage, CREDIT_HOLD_PERMISSIONS.viewPage]);

    expect(await screen.findByRole("link", { name: CREDIT_LABEL })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: ORDERS_LABEL })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: CREDIT_LABEL })).toHaveLength(1);
  });

  it("D. không có credit-hold VIEW_PAGE (chỉ quyền đơn) → không có mục hàng đợi", async () => {
    mountWith([ORDER_PERMISSIONS.viewPage, ORDER_PERMISSIONS.read]);

    expect(await screen.findByRole("link", { name: ORDERS_LABEL })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: CREDIT_LABEL })).not.toBeInTheDocument();
  });

  it("mục đang mở: khớp dài nhất — trang hàng đợi không sáng kèm 'Đơn hàng'", () => {
    const items = NAV_GROUPS.flatMap((group) => group.items);
    expect(findActiveNavHref(ADMIN_ROUTES.orders.creditHolds, items)).toBe(
      ADMIN_ROUTES.orders.creditHolds,
    );
    expect(findActiveNavHref(ADMIN_ROUTES.orders.detail("o-1"), items)).toBe(
      ADMIN_ROUTES.orders.list,
    );
    expect(findActiveNavHref(ADMIN_ROUTES.home, items)).toBe(ADMIN_ROUTES.home);
    // Không thấy mục hàng đợi → khớp trong các mục được thấy (trang tự chặn nếu thiếu quyền)
    const ordersOnly = items.filter((item) => item.href !== ADMIN_ROUTES.orders.creditHolds);
    expect(findActiveNavHref(ADMIN_ROUTES.orders.creditHolds, ordersOnly)).toBe(
      ADMIN_ROUTES.orders.list,
    );
  });

  it("breadcrumb hàng đợi cho ACCOUNTANT không dẫn qua 'Đơn hàng' (trang bị chặn)", () => {
    const accountantCanSee = (item: { permission?: PermissionCode }) =>
      !item.permission || item.permission === CREDIT_HOLD_PERMISSIONS.viewPage;
    expect(buildBreadcrumbItems(ADMIN_ROUTES.orders.creditHolds, accountantCanSee)).toEqual([
      { label: "Back-office", href: ADMIN_ROUTES.home },
      { label: CREDIT_LABEL, href: undefined },
    ]);
  });

  it("nhóm chỉ còn mục bị ẩn thì bỏ cả nhóm; mục hàng đợi chỉ cần quyền của chính nó", () => {
    const creditOnly = (item: { permission?: PermissionCode }) =>
      item.permission === CREDIT_HOLD_PERMISSIONS.viewPage;
    const groups = visibleNavGroups(creditOnly);
    expect(groups.map((group) => group.items.map((item) => item.href))).toEqual([
      [ADMIN_ROUTES.orders.creditHolds],
    ]);
    expect(groups.every((group) => group.items.length > 0)).toBe(true);
  });
});
