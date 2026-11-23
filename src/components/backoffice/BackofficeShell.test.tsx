import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  ADMIN_ROUTES,
  IDENTITY_PERMISSIONS,
  INVENTORY_PERMISSIONS,
  PUTAWAY_TASK_PERMISSIONS,
  WAREHOUSE_LOCATION_PERMISSIONS,
  WAREHOUSE_PERMISSIONS,
  WORKSPACE_PATHS,
} from "@/constants";
import { INVENTORY_LABELS, INVENTORY_ROUTES } from "@/constants/inventory";

import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";
import { useAppStore } from "@/lib/store/use-app-store";

import { ThemeProvider } from "@/components/theme-provider";

import { BackofficeShell, buildBreadcrumbItems } from "./BackofficeShell";

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
  useAppStore.setState({ focusMode: false });
});

async function renderShell(
  permissions: readonly PermissionCode[],
  role: RoleName = "Warehouse Staff",
  /** Phạm vi + kho được gán ở `/me/permissions` (BE #394). Mặc định `ALL`. */
  scope: { dataScope: "ALL" | "WAREHOUSE"; warehouses?: { id: string; prefix: string }[] } = {
    dataScope: "ALL",
  },
) {
  vi.spyOn(api, "get").mockImplementation(async (url: string) => {
    if (url === "/identity/me/permissions") {
      return { data: { roles: [role], permissions: [...permissions], ...scope } };
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
      mustChangePassword: false,
    },
    status: "authenticated",
    isAuthenticated: true,
    impersonatedRole: null,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter>
        <ThemeProvider>
          <BackofficeShell>
            <p>content</p>
          </BackofficeShell>
        </ThemeProvider>
      </NuqsTestingAdapter>
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
  // Sidebar drill-down: mục kho nằm trong màn con của item cha "Kho" — mở nó nếu đang ở màn gốc
  const sidebar = document.querySelector<HTMLElement>('[data-sidebar="content"]');
  const inventoryGroup = sidebar && within(sidebar).queryByRole("button", { name: /^Kho/ });
  if (inventoryGroup) await userEvent.click(inventoryGroup);
}

// Sidebar only — sub-pages also show the parent menu as a breadcrumb link.
function navLink(name: string) {
  const sidebar = document.querySelector<HTMLElement>('[data-sidebar="content"]');
  if (!sidebar) throw new Error("Sidebar content not rendered");
  return within(sidebar).queryByRole("link", { name });
}

describe("Inventory sidebar entries follow backend permission codes", () => {
  it.each([
    [
      [INVENTORY_PERMISSIONS.adjustmentViewPage, INVENTORY_PERMISSIONS.movementViewPage],
      true,
      true,
    ],
    [[INVENTORY_PERMISSIONS.adjustmentViewPage], true, false],
    [[INVENTORY_PERMISSIONS.movementViewPage], false, true],
    // READ is data access for other screens; the page needs VIEW_PAGE (BE ADR-0004)
    [[INVENTORY_PERMISSIONS.adjustmentRead, INVENTORY_PERMISSIONS.movementRead], false, false],
    [[], false, false],
  ] as const)("%j → adjustments %s, movements %s", async (permissions, adjustments, movements) => {
    await renderShell(permissions);
    expect(Boolean(navLink(ADJUSTMENTS))).toBe(adjustments);
    expect(Boolean(navLink(MOVEMENTS))).toBe(movements);
  });

  it("links to the canonical Inventory routes", async () => {
    await renderShell([
      INVENTORY_PERMISSIONS.adjustmentViewPage,
      INVENTORY_PERMISSIONS.movementViewPage,
    ]);
    expect(navLink(ADJUSTMENTS)).toHaveAttribute("href", INVENTORY_ROUTES.adjustments);
    expect(navLink(MOVEMENTS)).toHaveAttribute("href", INVENTORY_ROUTES.movements);
  });

  it("stock UPDATE alone does not show the adjustment list entry", async () => {
    await renderShell([INVENTORY_PERMISSIONS.stockUpdate, INVENTORY_PERMISSIONS.adjustmentApprove]);
    expect(navLink(ADJUSTMENTS)).not.toBeInTheDocument();
  });

  it.each<RoleName>(["System Admin", "Warehouse Manager"])(
    "%s without Inventory page codes sees no Inventory entry",
    async (role) => {
      await renderShell([], role);
      expect(navLink(ADJUSTMENTS)).not.toBeInTheDocument();
      expect(navLink(MOVEMENTS)).not.toBeInTheDocument();
    },
  );

  it("a non-allowlisted role with movement VIEW_PAGE sees Movement History", async () => {
    await renderShell([INVENTORY_PERMISSIONS.movementViewPage], "Accountant");
    expect(navLink(MOVEMENTS)).toBeInTheDocument();
  });

  it.each([
    INVENTORY_ROUTES.adjustments,
    INVENTORY_ROUTES.createAdjustment,
    INVENTORY_ROUTES.adjustment("d0000001-0000-4000-8000-000000000009"),
  ])("marks only the adjustment entry active on %s", async (pathname) => {
    navigation.pathname = pathname;
    await renderShell([
      INVENTORY_PERMISSIONS.adjustmentViewPage,
      INVENTORY_PERMISSIONS.movementViewPage,
      INVENTORY_PERMISSIONS.stockRead,
    ]);
    expect(navLink(INVENTORY_LABELS.overviewTitle)).not.toHaveAttribute("data-active", "true");
    expect(navLink(ADJUSTMENTS)).toHaveAttribute("data-active", "true");
    expect(navLink(MOVEMENTS)).not.toHaveAttribute("data-active", "true");
  });

  it("marks only Movement History active on its route", async () => {
    navigation.pathname = INVENTORY_ROUTES.movements;
    await renderShell([
      INVENTORY_PERMISSIONS.adjustmentViewPage,
      INVENTORY_PERMISSIONS.movementViewPage,
      INVENTORY_PERMISSIONS.stockUpdate,
    ]);
    expect(navLink(MOVEMENTS)).toHaveAttribute("data-active", "true");
    expect(navLink(ADJUSTMENTS)).not.toHaveAttribute("data-active", "true");
    // Di chuyển nội bộ đã vào tab theo kho (spec 2026-11-22) — không còn ở nhóm Kho
    expect(navLink(MOVES)).not.toBeInTheDocument();
  });

  it("Di chuyển nội bộ (trong tab theo kho) follows the backend guard of POST /inventory/movements (stock UPDATE)", async () => {
    navigation.pathname = ADMIN_ROUTES.warehouseMap.of("HCM");
    // Danh mục kho để nhóm tab có ≥ 2 mục (mở panel) — như NV kho thật
    await renderShell([WAREHOUSE_PERMISSIONS.viewPage, INVENTORY_PERMISSIONS.movementViewPage]);
    expect(navLink(MOVES)).not.toBeInTheDocument();
    cleanup();
    await renderShell([WAREHOUSE_PERMISSIONS.viewPage, INVENTORY_PERMISSIONS.stockUpdate]);
    expect(await screen.findByRole("link", { name: MOVES })).toHaveAttribute(
      "href",
      "/admin/warehouse-map/HCM/moves",
    );
  });

  it("marks Di chuyển nội bộ active on its page in the tab", async () => {
    navigation.pathname = ADMIN_ROUTES.warehouseMap.page("HCM", WORKSPACE_PATHS.moves);
    await renderShell([WAREHOUSE_PERMISSIONS.viewPage, INVENTORY_PERMISSIONS.stockUpdate]);
    expect(await screen.findByRole("link", { name: MOVES })).toHaveAttribute("data-active", "true");
  });
});

describe("shell shows no demo data against the real backend", () => {
  it("has no mock-only entries, no warning badges and no mock warehouse switcher", async () => {
    await renderShell([]);
    for (const name of ["Hoá đơn NCC", "Đề xuất nhập hàng"]) {
      expect(navLink(name)).not.toBeInTheDocument();
    }
    expect(document.querySelector('[data-sidebar="menu-badge"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Tất cả kho" })).not.toBeInTheDocument();
  });
});

describe("sidebar drill-down kiểu Vercel", () => {
  it("bấm item cha → thay bằng item con; tên item cha ở đầu là nút quay lại danh sách item cha", async () => {
    // renderShell tự mở màn con "Kho" khi đang ở màn gốc
    await renderShell([
      INVENTORY_PERMISSIONS.adjustmentViewPage,
      INVENTORY_PERMISSIONS.movementViewPage,
    ]);
    const sidebar = document.querySelector<HTMLElement>('[data-sidebar="content"]');
    if (!sidebar) throw new Error("Sidebar content not rendered");
    expect(navLink(ADJUSTMENTS)).toBeInTheDocument();
    expect(within(sidebar).queryByRole("button", { name: /^Kho/ })).not.toBeInTheDocument();

    await userEvent.click(within(sidebar).getByRole("button", { name: /^Quay lại Kho/ }));
    expect(navLink(ADJUSTMENTS)).not.toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: /^Kho/ })).toBeInTheDocument();
  });

  it("đang ở trang thuộc nhóm → mở sẵn màn con của nhóm đó", async () => {
    navigation.pathname = INVENTORY_ROUTES.movements;
    await renderShell([
      INVENTORY_PERMISSIONS.adjustmentViewPage,
      INVENTORY_PERMISSIONS.movementViewPage,
    ]);
    expect(navLink(MOVEMENTS)).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("button", { name: /^Quay lại Kho/ })).toBeInTheDocument();
  });
});

describe("Chế độ mở rộng (focusMode) và nút thu / mở sidebar", () => {
  // Tooltip (Radix popper) của nút thu / mở dùng ResizeObserver — jsdom không có
  beforeAll(() => {
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });
  const toggle = (name: string) => screen.getByRole("button", { name });

  it("bật rồi tắt chế độ mở rộng → sidebar về đúng lựa chọn của người dùng", async () => {
    await renderShell([]);
    await userEvent.click(toggle("Thu nhỏ sidebar"));
    act(() => useAppStore.getState().setFocusMode(true));
    expect(toggle("Mở rộng sidebar")).toBeInTheDocument();
    act(() => useAppStore.getState().setFocusMode(false));
    expect(toggle("Mở rộng sidebar")).toBeInTheDocument();
  });

  it("đang mở rộng mà bấm mở sidebar → thoát chế độ mở rộng và sidebar mở", async () => {
    await renderShell([]);
    act(() => useAppStore.getState().setFocusMode(true));
    await userEvent.click(toggle("Mở rộng sidebar"));
    expect(useAppStore.getState().focusMode).toBe(false);
    expect(toggle("Thu nhỏ sidebar")).toBeInTheDocument();
  });
});

describe("sidebar parent entries follow their visible items", () => {
  function sidebar() {
    const content = document.querySelector<HTMLElement>('[data-sidebar="content"]');
    if (!content) throw new Error("Sidebar content not rendered");
    return content;
  }
  const parent = (title: string) =>
    within(sidebar()).queryByRole("button", { name: new RegExp(`^${title}`) });
  // renderShell mở màn con "Kho" — quay về màn gốc để thấy các item cha
  async function showRoot() {
    const back = within(sidebar()).queryByRole("button", { name: /^Quay lại/ });
    if (back) await userEvent.click(back);
  }

  it("drops a parent entry when every item in it is denied", async () => {
    await renderShell([]);
    await showRoot();
    expect(parent("Platform")).not.toBeInTheDocument();
    expect(navLink("Phân quyền")).not.toBeInTheDocument();
    expect(navLink("Tổng quan")).toBeInTheDocument();
  });

  it("a group with one allowed item shows that item as a direct link", async () => {
    await renderShell([IDENTITY_PERMISSIONS.rbacRead]);
    await showRoot();
    expect(navLink("Phân quyền")).toBeInTheDocument();
    expect(parent("Platform")).not.toBeInTheDocument();
  });

  it("keeps the parent entry when several of its items are allowed", async () => {
    await renderShell([IDENTITY_PERMISSIONS.rbacRead, IDENTITY_PERMISSIONS.usersRead]);
    await showRoot();
    expect(parent("Platform")).toBeInTheDocument();
  });

  it("collapsed sidebar renders no separator for a group with no visible item", async () => {
    await renderShell([]);
    await userEvent.click(screen.getByRole("button", { name: "Thu nhỏ sidebar" }));
    // Thu gọn: mỗi nhóm là một khối (vạch ngăn + icon) — khối nào cũng phải có ít nhất một link
    const menu = sidebar().querySelector<HTMLElement>('[data-sidebar="menu"]');
    if (!menu) throw new Error("Collapsed menu not rendered");
    const groups = menu.querySelectorAll<HTMLElement>(":scope > *");
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups)
      expect(within(group).queryAllByRole("link").length).toBeGreaterThan(0);
  });
});

describe('tab "Kho & bản đồ" tách riêng', () => {
  const PERMS = [
    WAREHOUSE_PERMISSIONS.viewPage,
    WAREHOUSE_PERMISSIONS.read,
    WAREHOUSE_LOCATION_PERMISSIONS.viewPage,
    PUTAWAY_TASK_PERMISSIONS.viewPage,
  ];

  it("ở màn gốc sidebar, bấm tab là tới gốc tab (vào thẳng kho được gán duy nhất, hoặc Danh mục kho)", async () => {
    navigation.pathname = ADMIN_ROUTES.home;
    await renderShell(PERMS);
    expect(navLink("Kho & bản đồ")).toHaveAttribute("href", ADMIN_ROUTES.warehouseMap.root);
  });

  it("chưa vào kho nào → panel chỉ có Danh mục kho (chọn kho ở đó), không liệt kê kho", async () => {
    navigation.pathname = ADMIN_ROUTES.warehouses.list;
    await renderShell(PERMS);
    expect(screen.getByRole("button", { name: /^Quay lại Kho & bản đồ/ })).toBeInTheDocument();
    expect(screen.getByText(/Chọn một kho ở Danh mục kho/)).toBeInTheDocument();
    expect(navLink("Danh mục kho")).toHaveAttribute("aria-current", "page");
    expect(navLink("Bản đồ kho")).not.toBeInTheDocument();
  });

  it("trong một kho → panel là các trang của kho đó; breadcrumb có kho + nút đổi kho", async () => {
    navigation.pathname = ADMIN_ROUTES.warehouseMap.of("HCM");
    await renderShell(PERMS);
    expect(navLink("Bản đồ kho")).toHaveAttribute("aria-current", "page");
    expect(navLink("Gợi ý vị trí")).toHaveAttribute(
      "href",
      ADMIN_ROUTES.warehouseMap.slotting("HCM"),
    );
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Kho & bản đồ" })).toBeInTheDocument();
    expect(within(crumbs).getByRole("button", { name: /Đổi kho: HCM/ })).toBeInTheDocument();
    expect(crumbs).toHaveTextContent("Bản đồ kho");
  });

  it("trong một kho, không có quyền cất hàng → không có link Gợi ý vị trí", async () => {
    navigation.pathname = ADMIN_ROUTES.warehouseMap.of("HCM");
    await renderShell(PERMS.filter((code) => code !== PUTAWAY_TASK_PERMISSIONS.viewPage));
    expect(navLink("Bản đồ kho")).toBeInTheDocument();
    expect(navLink("Gợi ý vị trí")).not.toBeInTheDocument();
  });

  it('trong một kho → panel có tiêu đề nhóm "Bản đồ"; nhóm "Vận hành" rỗng thì không hiện', async () => {
    navigation.pathname = ADMIN_ROUTES.warehouseMap.of("HCM");
    // Không có quyền màn vận hành nào → nhóm "Vận hành" rỗng
    await renderShell(PERMS.filter((code) => code !== PUTAWAY_TASK_PERMISSIONS.viewPage));
    const panel = document.querySelector<HTMLElement>('[data-sidebar="content"]');
    if (!panel) throw new Error("Sidebar not rendered");
    expect(within(panel).getByText("Bản đồ")).toBeInTheDocument();
    expect(within(panel).queryByText("Vận hành")).not.toBeInTheDocument();
  });

  it('trong một kho, có quyền cất hàng → nhóm "Vận hành" có Cất hàng của kho đó', async () => {
    navigation.pathname = ADMIN_ROUTES.warehouseMap.of("HCM");
    await renderShell(PERMS);
    const panel = document.querySelector<HTMLElement>('[data-sidebar="content"]');
    if (!panel) throw new Error("Sidebar not rendered");
    expect(within(panel).getByText("Vận hành")).toBeInTheDocument();
    expect(navLink("Cất hàng")).toHaveAttribute("href", "/admin/warehouse-map/HCM/putaway");
  });

  it("chỉ có quyền một trang trong kho (không có quyền bản đồ) → tab vẫn hiện", async () => {
    navigation.pathname = ADMIN_ROUTES.home;
    await renderShell([PUTAWAY_TASK_PERMISSIONS.viewPage]);
    expect(navLink("Kho & bản đồ")).toBeInTheDocument();
  });

  it("không có quyền bản đồ → panel trong kho không có dòng Bản đồ, vẫn có trang được phép", async () => {
    navigation.pathname = ADMIN_ROUTES.warehouseMap.slotting("HCM");
    // Danh mục kho để nhóm có ≥ 2 mục (nhóm một mục thì sidebar link thẳng, không mở panel) — như NV kho thật
    await renderShell([WAREHOUSE_PERMISSIONS.viewPage, PUTAWAY_TASK_PERMISSIONS.viewPage]);
    expect(await screen.findByRole("link", { name: "Gợi ý vị trí" })).toBeInTheDocument();
    expect(navLink("Bản đồ kho")).not.toBeInTheDocument();
  });

  it("kho không được gán → panel chỉ còn Bản đồ (bản đồ không giới hạn theo kho được gán — 06)", async () => {
    navigation.pathname = ADMIN_ROUTES.warehouseMap.of("HCM");
    await renderShell(PERMS, "Warehouse Staff", {
      dataScope: "WAREHOUSE",
      warehouses: [{ id: "wh-bd", prefix: "BD" }],
    });
    expect(await screen.findByRole("link", { name: "Bản đồ kho" })).toBeInTheDocument();
    expect(navLink("Gợi ý vị trí")).not.toBeInTheDocument();
  });

  it("breadcrumb trang Gợi ý vị trí: nhãn cuối là tên trang", () => {
    expect(buildBreadcrumbItems(ADMIN_ROUTES.warehouseMap.slotting("BD")).at(-1)?.label).toBe(
      "Gợi ý vị trí",
    );
  });

  it('nhóm "Kho" không còn chứa trang của module bản đồ', async () => {
    navigation.pathname = INVENTORY_ROUTES.movements;
    await renderShell([
      INVENTORY_PERMISSIONS.movementViewPage,
      INVENTORY_PERMISSIONS.adjustmentViewPage,
      WAREHOUSE_PERMISSIONS.viewPage,
    ]);
    expect(navLink(MOVEMENTS)).toBeInTheDocument();
    expect(navLink("Danh mục kho")).not.toBeInTheDocument();
  });
});
