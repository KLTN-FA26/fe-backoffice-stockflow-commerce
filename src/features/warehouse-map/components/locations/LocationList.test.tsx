import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS, WAREHOUSE_LOCATION_LABELS as L } from "@/constants";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";
import { WorkspaceWarehouseProvider } from "@/lib/workspace";

import { LAYOUT } from "@/features/warehouse-map/__fixtures__/layout";

import { LocationList } from "./LocationList";

import type { AssignedWarehouse, PermissionCode } from "@/lib/auth";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};

const HCM = { id: "wh-hcm", prefix: "HCM", name: "Kho Hồ Chí Minh" };
const LAYOUT_URL = "/warehouses/wh-hcm/layout";
const STOCK_URL = "/inventory/warehouses/wh-hcm/stock-items";
const CARTONS_URL = "/inventory/stock-packages";
const SUMMARY_URL = "/inventory/stock-packages/location-summary";

const page = <T,>(items: T[]) => ({
  items,
  page: 0,
  size: 200,
  totalElements: items.length,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
});

const STOCK = [
  { locationCode: "HCM-A01-1-A", sku: "SOFA-01", lotNumber: "L1", onHand: 10, reserved: 4 },
  { locationCode: "HCM-A01-1-A", sku: "SOFA-02", lotNumber: "L2", onHand: 5, reserved: 0 },
  { locationCode: "HCM-RCV01", sku: "CHAIR-9", onHand: 12, reserved: 0 },
];

const locationOf = (params: unknown) =>
  typeof params === "object" && params !== null && "location" in params ? params.location : null;

/** Quản lý kho: bản đồ + tồn + thùng + lịch sử di chuyển. */
const MANAGER: PermissionCode[] = [
  "warehouse-locations:VIEW_PAGE",
  "warehouse-locations:READ",
  "inventory-stock-items:READ",
  "inventory-stock-packages:READ",
  "inventory-stock-movements:VIEW_PAGE",
];
/** Xem được bản đồ nhưng không có quyền tồn. */
const MAP_ONLY: PermissionCode[] = ["warehouse-locations:VIEW_PAGE", "warehouse-locations:READ"];

function setup(
  permissions: readonly PermissionCode[],
  opts: { warehouses?: AssignedWarehouse[]; search?: string } = {},
) {
  const get = vi
    .spyOn(api, "get")
    .mockImplementation(async (url: string, config?: { params?: unknown }) => {
      if (url === "/identity/me/permissions")
        return {
          data: {
            roles: ["TEST"],
            permissions,
            dataScope: opts.warehouses ? "WAREHOUSE" : "ALL",
            ...(opts.warehouses ? { warehouses: opts.warehouses } : {}),
          },
        };
      if (url === LAYOUT_URL) return { data: LAYOUT };
      if (url === STOCK_URL) return { data: page(STOCK) };
      if (url === SUMMARY_URL)
        return {
          data: [
            {
              sku: "SOFA-01",
              lotNumber: "L1",
              status: "AVAILABLE",
              wholeCartons: 2,
              wholeCartonUnits: 10,
              looseUnits: 0,
              totalUnits: 10,
            },
          ],
        };
      if (url === CARTONS_URL && locationOf(config?.params) === "HCM-A01-1-A")
        return {
          data: page([
            {
              lpn: "LPN-20261111-000001",
              sku: "SOFA-01",
              lotNumber: "L1",
              nominalQty: 5,
              onHand: 5,
              reserved: 0,
              status: "IN_STOCK",
            },
          ]),
        };
      throw new Error(`Không có mock cho GET ${url}`);
    });
  useAuthStore.setState({
    user: {
      userId: "u-test",
      fullName: "Test",
      email: "t@example.com",
      roles: ["TEST"],
      username: "test",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    isAuthenticated: true,
    status: "authenticated",
    impersonatedRole: null,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={opts.search ?? ""} hasMemory>
        <WorkspaceWarehouseProvider value={HCM}>
          <Suspense fallback={<div>loading</div>}>
            <LocationList />
          </Suspense>
        </WorkspaceWarehouseProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
  const calls = (url: string) => get.mock.calls.filter(([called]) => called === url).length;
  return { user: userEvent.setup(), calls };
}

const rowCodes = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).queryByRole("button", { name: /^HCM-/ })?.textContent)
    .filter(Boolean);
const header = (name: string) => screen.queryByRole("columnheader", { name: new RegExp(name) });

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("Danh sách vị trí — quản lý kho ở kho được gán", () => {
  it("liệt kê mọi bin và khu vực có mã, kèm hàng trong vị trí", async () => {
    setup(MANAGER, { warehouses: [{ id: "wh-hcm", prefix: "HCM" }] });
    expect(await screen.findByRole("button", { name: "HCM-A01-1-A" })).toBeInTheDocument();
    expect(rowCodes()).toEqual(["HCM-A01-1-A", "HCM-A01-1-B", "HCM-A01-2-A", "HCM-RCV01"]);
    const first = screen.getAllByRole("row")[1];
    expect(await within(first!).findByText("SOFA-01")).toBeInTheDocument();
    expect(within(first!).getByText("15")).toBeInTheDocument();
  });

  it("search chính lọc theo mã hoặc SKU phía FE — không gọi lại API", async () => {
    const { user, calls } = setup(MANAGER);
    await screen.findByRole("button", { name: "HCM-A01-1-A" });
    await waitFor(() => expect(calls(STOCK_URL)).toBe(1));
    await user.type(screen.getByPlaceholderText(L.searchPlaceholder), "chair");
    await waitFor(() => expect(rowCodes()).toEqual(["HCM-RCV01"]));
    expect(calls(LAYOUT_URL)).toBe(1);
    expect(calls(STOCK_URL)).toBe(1);
  });

  it("lọc từ link (?status=BLOCKED) → chỉ bin bị khoá, có chip; X trả lại dòng", async () => {
    const { user } = setup(MANAGER, { search: "?status=BLOCKED" });
    await waitFor(() => expect(rowCodes()).toEqual(["HCM-A01-1-B"]));
    await user.click(screen.getByRole("button", { name: `Xoá ${L.column.status}` }));
    await waitFor(() => expect(rowCodes()).toHaveLength(4));
  });

  it("lọc không ra → empty 'Không tìm thấy' giữ header, Bỏ bộ lọc trả lại dòng", async () => {
    const { user } = setup(MANAGER, { search: "?code=khong-co" });
    expect(await screen.findByText(L.filteredTitle)).toBeInTheDocument();
    expect(header(L.column.code)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: L.clearFilters }));
    await waitFor(() => expect(rowCodes()).toHaveLength(4));
  });

  it("tắt một cột → header biến mất, chip x/y; X đưa cột về", async () => {
    const { user } = setup(MANAGER);
    await screen.findByRole("button", { name: "HCM-A01-1-A" });
    await user.click(screen.getByRole("button", { name: "Ẩn hiện cột" }));
    await user.click(screen.getByRole("option", { name: L.column.zone }));
    expect(header(L.column.zone)).not.toBeInTheDocument();
    expect(screen.getByText(`${L.summaryColumns}: 12/13`)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: `Xoá ${L.summaryColumns}` }));
    expect(header(L.column.zone)).toBeInTheDocument();
  });

  it("cột đã lưu có key lạ → bỏ, vẫn giữ cột mã vị trí", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.adminWarehouseLocationsConfig,
      JSON.stringify({ visibleColumns: ["status", "bogus"], pageSize: 7 }),
    );
    setup(MANAGER);
    await screen.findByRole("button", { name: "HCM-A01-1-A" });
    expect(header(L.column.code)).toBeInTheDocument();
    expect(header(L.column.status)).toBeInTheDocument();
    expect(header(L.column.zone)).not.toBeInTheDocument();
  });

  it("mở chi tiết: hàng theo SKU / lô / trạng thái và LPN có nút sao chép", async () => {
    const { user } = setup(MANAGER);
    await user.click(await screen.findByRole("button", { name: "HCM-A01-1-A" }));
    const panel = await screen.findByRole("dialog", { name: "HCM-A01-1-A" });
    expect(await within(panel).findByText("LPN-20261111-000001")).toBeInTheDocument();
    expect(within(panel).getByText("Khả dụng")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: L.detail.movements })).toHaveAttribute(
      "href",
      "/admin/movements?location=HCM-A01-1-A",
    );
    await user.click(within(panel).getByRole("button", { name: "Sao chép LPN-20261111-000001" }));
    expect(await navigator.clipboard.readText()).toBe("LPN-20261111-000001");
  });
});

describe("Danh sách vị trí — phân quyền (UI-only, BE re-check)", () => {
  it("không có quyền tồn → báo, bỏ cột hàng, không gọi API tồn", async () => {
    const { calls } = setup(MAP_ONLY);
    expect(await screen.findByText(L.stockNoPermission)).toBeInTheDocument();
    expect(rowCodes()).toHaveLength(4);
    expect(header(L.column.onHand)).not.toBeInTheDocument();
    expect(calls(STOCK_URL)).toBe(0);
  });

  it("không được gán kho này → vẫn xem mã vị trí, không gọi API tồn (tránh 403)", async () => {
    const { user, calls } = setup(MANAGER, { warehouses: [{ id: "wh-bd", prefix: "BD" }] });
    expect(await screen.findByText(L.stockNotAssigned)).toBeInTheDocument();
    expect(calls(STOCK_URL)).toBe(0);
    await user.click(screen.getByRole("button", { name: "HCM-A01-1-A" }));
    const panel = await screen.findByRole("dialog", { name: "HCM-A01-1-A" });
    expect(within(panel).getByText(L.detail.contentsNoPermission)).toBeInTheDocument();
    expect(calls(SUMMARY_URL)).toBe(0);
    expect(calls(CARTONS_URL)).toBe(0);
  });

  it("không có quyền xem bản đồ → chặn cả trang, không gọi layout", async () => {
    const { calls } = setup(["inventory-stock-items:READ"]);
    await waitFor(() => expect(calls("/identity/me/permissions")).toBeGreaterThan(0));
    expect(screen.queryByRole("button", { name: "HCM-A01-1-A" })).not.toBeInTheDocument();
    expect(calls(LAYOUT_URL)).toBe(0);
  });
});
