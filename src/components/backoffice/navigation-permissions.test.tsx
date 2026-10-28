import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { INVENTORY_LABELS } from "@/constants/inventory";
import {
  ATTRIBUTE_PERMISSIONS,
  CREDIT_HOLD_PERMISSIONS,
  FULFILLMENT_PICKING_PERMISSIONS,
  FULFILLMENT_PICK_PERMISSIONS,
  FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS,
  IDENTITY_PERMISSIONS,
  INVENTORY_ITEM_PERMISSIONS,
  INVENTORY_OVERVIEW_PERMISSIONS,
  LOAD_PLAN_PERMISSIONS,
  ORDER_PERMISSIONS,
  PRODUCT_PERMISSIONS,
  SHIPMENT_PERMISSIONS,
  SUPPLIER_PERMISSIONS,
  VEHICLE_TYPE_PERMISSIONS,
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
  it("brands & categories follow product-products:VIEW_PAGE (ProductTaxonomyController)", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions: [PRODUCT_PERMISSIONS.viewPage], dataScope: "ALL" },
    });
    mount();
    expect(screen.queryByRole("link", { name: "Thương hiệu & danh mục" })).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Thương hiệu & danh mục" })).toHaveAttribute(
      "href",
      "/admin/taxonomy",
    );
    expect(screen.queryByRole("link", { name: "Từ điển thuộc tính" })).not.toBeInTheDocument();
  });
  it.each([
    [
      "fulfillment-picking:READ (NV kho / quản lý kho)",
      [FULFILLMENT_PICKING_PERMISSIONS.read],
      true,
    ],
    [
      "điều phối (pick-lists + task-assignment, không có fulfillment-picking)",
      [
        ...Object.values(FULFILLMENT_PICK_PERMISSIONS),
        FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS.update,
      ],
      false,
    ],
  ] as const)("menu Trả hàng về kệ với %s → hiện: %s", async (_, permissions, visible) => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: {
        roles: [],
        permissions: [...permissions, IDENTITY_PERMISSIONS.rbacRead],
        dataScope: "ALL",
      },
    });
    mount();
    expect(await screen.findByRole("link", { name: "Phân quyền" })).toBeInTheDocument();
    const link = screen.queryByRole("link", { name: "Trả hàng về kệ" });
    expect(link !== null).toBe(visible);
    if (link) expect(link).toHaveAttribute("href", "/admin/put-backs");
  });
  it("hồ sơ hàng tồn theo inventory-inventory-items:VIEW_PAGE (BE PR #119)", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions: [INVENTORY_ITEM_PERMISSIONS.viewPage], dataScope: "ALL" },
    });
    mount();
    expect(screen.queryByRole("link", { name: "Hồ sơ hàng tồn" })).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Hồ sơ hàng tồn" })).toHaveAttribute(
      "href",
      "/admin/inventory-items",
    );
  });
  it("read-only RBAC navigation uses the real backend READ capability", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions: [IDENTITY_PERMISSIONS.rbacRead], dataScope: "ALL" },
    });
    mount();
    expect(await screen.findByRole("link", { name: "Phân quyền" })).toBeInTheDocument();
  });
  it("Người dùng theo identity-users:READ, không theo quyền Phân quyền (SCRUM-458)", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions: [IDENTITY_PERMISSIONS.usersRead], dataScope: "ALL" },
    });
    mount();
    expect(screen.queryByRole("link", { name: "Người dùng" })).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Người dùng" })).toHaveAttribute(
      "href",
      "/admin/users",
    );
    expect(screen.queryByRole("link", { name: "Phân quyền" })).not.toBeInTheDocument();
  });
  it("chỉ có quyền Phân quyền thì không thấy menu Người dùng", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions: [IDENTITY_PERMISSIONS.rbacRead], dataScope: "ALL" },
    });
    mount();
    expect(await screen.findByRole("link", { name: "Phân quyền" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Người dùng" })).not.toBeInTheDocument();
  });
  it("giao cho hãng (Lô giao, Chuyến xe) nối BE thật theo quyền xem màn, không còn chỉ-mock", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions: [SHIPMENT_PERMISSIONS.viewPage], dataScope: "ALL" },
    });
    mockMode.isMock = false;
    mount();
    expect(await screen.findByRole("link", { name: "Lô giao" })).toHaveAttribute(
      "href",
      "/admin/shipments",
    );
    expect(screen.getByRole("link", { name: "Chuyến xe" })).toHaveAttribute("href", "/admin/loads");
    // Kế hoạch xếp xe có resource quyền riêng: quyền xem màn giao hàng không đủ
    expect(screen.queryByRole("link", { name: "Kế hoạch xếp xe" })).not.toBeInTheDocument();
  });
  it("Kế hoạch xếp xe theo fulfillment-load-plans:VIEW_PAGE (BE PR #161)", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions: [LOAD_PLAN_PERMISSIONS.viewPage], dataScope: "ALL" },
    });
    mockMode.isMock = false;
    mount();
    expect(screen.queryByRole("link", { name: "Kế hoạch xếp xe" })).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Kế hoạch xếp xe" })).toHaveAttribute(
      "href",
      "/admin/load-plans",
    );
    expect(screen.queryByRole("link", { name: "Chuyến xe" })).not.toBeInTheDocument();
  });
  it("thiếu quyền xem màn giao hàng → ẩn Lô giao và Chuyến xe", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions: [], dataScope: "ALL" },
    });
    mockMode.isMock = false;
    mount();
    expect(await screen.findByRole("link", { name: "Tổng quan" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Lô giao" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Chuyến xe" })).not.toBeInTheDocument();
  });
  it("Loại xe theo fulfillment-vehicle-types:VIEW_PAGE (BE PR #153)", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions: [VEHICLE_TYPE_PERMISSIONS.viewPage], dataScope: "ALL" },
    });
    mount();
    expect(screen.queryByRole("link", { name: "Loại xe" })).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Loại xe" })).toHaveAttribute(
      "href",
      "/admin/vehicle-types",
    );
  });
  it("quyền xem màn giao hàng không đủ để thấy Loại xe (resource riêng)", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions: [SHIPMENT_PERMISSIONS.viewPage], dataScope: "ALL" },
    });
    mount();
    expect(await screen.findByRole("link", { name: "Chuyến xe" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Loại xe" })).not.toBeInTheDocument();
  });
  it("Đề xuất nhập hàng (BE chưa có API) chỉ hiện ở mock, không phụ thuộc quyền", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions: [], dataScope: "ALL" },
    });
    mockMode.isMock = false;
    mount();
    expect(await screen.findByRole("link", { name: "Tổng quan" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Đề xuất nhập hàng" })).not.toBeInTheDocument();

    cleanup();
    mockMode.isMock = true;
    mount();
    expect(await screen.findByRole("link", { name: "Đề xuất nhập hàng" })).toBeInTheDocument();
    mockMode.isMock = false;
  });
  it("Hoá đơn NCC (BE chưa có API hoá đơn) chỉ hiện ở mock, không phụ thuộc quyền", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions: [], dataScope: "ALL" },
    });
    mockMode.isMock = false;
    mount();
    expect(await screen.findByRole("link", { name: "Tổng quan" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Hoá đơn NCC" })).not.toBeInTheDocument();

    cleanup();
    mockMode.isMock = true;
    mount();
    expect(await screen.findByRole("link", { name: "Hoá đơn NCC" })).toBeInTheDocument();
    mockMode.isMock = false;
  });
  it("Từ điển thuộc tính theo quyền xem trang product-attributes và dẫn tới màn thật, không phải màn dữ liệu mẫu", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions: [ATTRIBUTE_PERMISSIONS.viewPage], dataScope: "ALL" },
    });
    mount();
    const link = await screen.findByRole("link", { name: "Từ điển thuộc tính" });
    expect(link).toHaveAttribute("href", "/admin/attributes");
    expect(screen.queryByRole("link", { name: "Thuộc tính biến thể" })).not.toBeInTheDocument();
  });
  it("không có quyền xem trang product-attributes thì ẩn Từ điển thuộc tính", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions: [], dataScope: "ALL" },
    });
    mount();
    await screen.findByRole("link", { name: "Tổng quan" });
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Từ điển thuộc tính" })).not.toBeInTheDocument(),
    );
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

describe("mockOnly đi chung pipeline hiển thị + mục đang mở (một tập mục được thấy)", () => {
  /** Chạy đúng pipeline của sidebar: quyền + mockOnly → nhóm được thấy → mục đang mở. */
  function ActiveProbe({ pathname }: { pathname: string }) {
    const canSee = useCanSeeNavItem();
    const groups = visibleNavGroups(canSee);
    const active = findActiveNavHref(
      pathname,
      groups.flatMap((group) => group.items),
    );
    return (
      <>
        <output aria-label="active">{active ?? "none"}</output>
        <output aria-label="visible">
          {groups.flatMap((group) => group.items.map((item) => item.href)).join(" ")}
        </output>
      </>
    );
  }

  function probe(pathname: string, permissions: string[]) {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { roles: [], permissions, dataScope: "ALL" },
    });
    render(
      <QueryClientProvider client={client}>
        <ActiveProbe pathname={pathname} />
      </QueryClientProvider>,
    );
  }

  // Mục mockOnly hiện tại (BE chưa có API hoá đơn NCC); Chuyến xe / Vận đơn đã có BE nên không còn mockOnly
  const MOCK_ONLY_ROUTE = "/admin/invoices";
  const SHIPMENT_DETAIL = ADMIN_ROUTES.shipments.detail("trip-1");

  afterEach(() => {
    mockMode.isMock = false;
  });

  it("A/B. ngoài mock: mục mockOnly ẩn và KHÔNG thành mục đang mở dù đúng route của nó", async () => {
    mockMode.isMock = false;
    probe(MOCK_ONLY_ROUTE, [SHIPMENT_PERMISSIONS.viewPage]);
    await waitFor(() =>
      expect(screen.getByLabelText("visible")).toHaveTextContent(ADMIN_ROUTES.shipments.list),
    );
    expect(screen.getByLabelText("visible")).not.toHaveTextContent(MOCK_ONLY_ROUTE);
    expect(screen.getByLabelText("active")).toHaveTextContent("none");
  });

  it("C. trong mock: mục mockOnly hiện và sáng theo route như mọi mục khác", async () => {
    mockMode.isMock = true;
    probe(MOCK_ONLY_ROUTE, [SHIPMENT_PERMISSIONS.viewPage]);
    await waitFor(() => expect(screen.getByLabelText("active")).toHaveTextContent(MOCK_ONLY_ROUTE));
  });

  it("D. trong mock nhưng thiếu quyền của mục → vẫn ẩn, không sáng (quyền vẫn áp dụng)", async () => {
    mockMode.isMock = true;
    probe(SHIPMENT_DETAIL, [ORDER_PERMISSIONS.viewPage]);
    await waitFor(() =>
      expect(screen.getByLabelText("visible")).toHaveTextContent(ADMIN_ROUTES.orders.list),
    );
    expect(screen.getByLabelText("visible")).not.toHaveTextContent(ADMIN_ROUTES.shipments.list);
    expect(screen.getByLabelText("active")).toHaveTextContent("none");
  });
});
