import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CARTON_LIST_LABELS as L, STORAGE_KEYS } from "@/constants";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import { CartonList } from "./CartonList";

import type { AxiosRequestConfig } from "axios";
import type { AssignedWarehouse, PermissionCode } from "@/lib/auth";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};

const HCM = "0e380000-0000-4000-8000-000000000001";
const BD = "0e380000-0000-4000-8000-000000000009";
const TASK = "0e380000-0000-4000-8000-000000000003";
const ORDER = "0e380000-0000-4000-8000-000000000004";

const ROW = {
  lpn: "LPN-20261111-000046",
  sku: "BAG-CUP-2",
  unitOfMeasure: "CARTON",
  nominalQty: 500,
  receivedQty: 500,
  lotNumber: "LOT-2026-04",
  onHand: 480,
  reserved: 20,
  status: "IN_STOCK",
  locationCode: "HCM-QC01",
  warehouseId: HCM,
  warehouseCode: "HCM",
  productName: "Túi đựng ly",
  variantName: "Túi đựng 2 ly",
  stockStatuses: ["QUARANTINE"],
  receivedAt: "2026-11-11T13:19:35.225Z",
  source: "IN_WAREHOUSE",
  heldFor: [{ orderId: ORDER, orderNumber: "SO-20261120-0001", quantity: 20 }],
  openTask: { type: "CYCLE_COUNT", id: TASK, number: "CC-0007" },
};
const page = <T,>(items: T[]) => ({
  items,
  page: 0,
  size: 25,
  totalElements: items.length,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
});
const MOVEMENT = {
  movementId: "0e380000-0000-4000-8000-000000000005",
  type: "MOVE",
  sku: "BAG-CUP-2",
  fromLocation: "HCM-B01-1-A",
  toLocation: "HCM-QC01",
  quantity: 500,
  referenceType: "MOVE_TASK",
  occurredAt: "2026-11-20T03:00:00Z",
  actorName: "Trần Minh Quang",
  fromLpn: ROW.lpn,
  toLpn: ROW.lpn,
};

/** Quản lý kho: trang + đọc thùng + lịch sử + danh mục kho. */
const MANAGER: PermissionCode[] = [
  "inventory-stock-packages:VIEW_PAGE",
  "inventory-stock-packages:READ",
  "inventory-stock-movements:READ",
  "warehouse-warehouses:READ",
];

function setup(
  permissions: readonly PermissionCode[],
  opts: {
    search?: string;
    warehouses?: AssignedWarehouse[];
    /** Ghi đè phản hồi cho một request (trả undefined → dùng mock mặc định). */
    respond?: (config: AxiosRequestConfig) => { status: number; data: unknown } | undefined;
  } = {},
) {
  vi.spyOn(api, "get").mockImplementation(async (url: string) => {
    if (url === "/identity/me/permissions")
      return {
        data: {
          roles: ["TEST"],
          permissions,
          dataScope: opts.warehouses ? "WAREHOUSE" : "ALL",
          ...(opts.warehouses ? { warehouses: opts.warehouses } : {}),
        },
      };
    if (url === "/warehouses")
      return {
        data: page([
          { id: HCM, prefix: "HCM", name: "Kho Hồ Chí Minh" },
          { id: BD, prefix: "BD", name: "Kho Bình Dương" },
        ]),
      };
    throw new Error(`Không có mock cho GET ${url}`);
  });
  const request = vi
    .spyOn(api, "request")
    .mockImplementation(async (config: AxiosRequestConfig) => {
      const override = opts.respond?.(config);
      if (override) return override;
      if (config.url === "/inventory/stock-packages") return { status: 200, data: page([ROW]) };
      if (config.url === `/inventory/stock-packages/${ROW.lpn}`)
        return {
          status: 200,
          data: {
            ...ROW,
            closedAt: null,
            contents: [
              { lotNumber: "LOT-2026-04", status: "QUARANTINE", onHand: 480, reserved: 20 },
            ],
          },
        };
      if (config.url === "/inventory/movements") return { status: 200, data: page([MOVEMENT]) };
      throw new Error(`Không có mock cho ${config.method ?? "GET"} ${config.url}`);
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
        <Suspense fallback={<div>loading</div>}>
          <CartonList />
        </Suspense>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
  const listCalls = () =>
    request.mock.calls
      .map(([config]) => config)
      .filter((c) => c.url === "/inventory/stock-packages");
  return { user: userEvent.setup(), listCalls, request };
}

const qOf = (params: unknown) =>
  typeof params === "object" && params !== null && "q" in params ? params.q : undefined;
const header = (name: string) => screen.queryByRole("columnheader", { name: new RegExp(name) });

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("Thùng hàng (LPN) — danh sách", () => {
  it("hiện đủ thông tin đọc được của thùng và link sang nơi xử lý", async () => {
    setup(MANAGER);
    const lpn = await screen.findByRole("button", { name: ROW.lpn });
    const row = lpn.closest("tr");
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement);
    expect(cells.getByText("Túi đựng 2 ly")).toBeInTheDocument();
    expect(cells.getByText("HCM")).toBeInTheDocument();
    expect(cells.getByRole("link", { name: "HCM-QC01" })).toHaveAttribute(
      "href",
      "/admin/warehouse-map/HCM/locations?code=HCM-QC01",
    );
    expect(cells.getByRole("link", { name: /Đang kiểm kê · CC-0007/ })).toHaveAttribute(
      "href",
      `/admin/warehouse-map/HCM/cycle-counts/${TASK}`,
    );
    expect(cells.getByText("Cách ly")).toBeInTheDocument();
  });

  it("search một phần LPN: dưới 3 ký tự chỉ nhắc, không gọi BE; đủ 3 ký tự mới gửi q", async () => {
    const { user, listCalls } = setup(MANAGER);
    await screen.findByRole("button", { name: ROW.lpn });
    await user.type(screen.getByPlaceholderText(L.searchPlaceholder), "04");
    expect(await screen.findByText(L.searchTooShort(3))).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(listCalls().some((c) => qOf(c.params))).toBe(false);
    await user.type(screen.getByPlaceholderText(L.searchPlaceholder), "6");
    await waitFor(() => expect(qOf(listCalls().at(-1)?.params)).toBe("046"));
  });

  it("lọc trạng thái tồn từ link → gửi stockStatus dạng lặp lại (indexes: null) cho Spring", async () => {
    const { listCalls } = setup(MANAGER, { search: "?stockStatus=QUARANTINE&sort=receivedAt" });
    await screen.findByRole("button", { name: ROW.lpn });
    const last = listCalls().at(-1);
    expect(last?.params).toMatchObject({ stockStatus: ["QUARANTINE"], sort: "receivedAt,asc" });
    expect(last?.paramsSerializer).toEqual({ indexes: null });
  });

  it("tắt một cột → header biến mất; cột lưu có key lạ → bỏ, giữ cột LPN", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.adminInventoryCartonsConfig,
      JSON.stringify({ visibleColumns: ["warehouse", "bogus"], pageSize: 7 }),
    );
    setup(MANAGER);
    await screen.findByRole("button", { name: ROW.lpn });
    expect(header(L.column.lpn)).toBeInTheDocument();
    expect(header(L.column.warehouse)).toBeInTheDocument();
    expect(header(L.column.product)).not.toBeInTheDocument();
  });

  it("mở chi tiết qua ?lpn=: thông tin, đơn đang giữ, việc đang làm, lịch sử theo LPN", async () => {
    const { request } = setup(MANAGER, { search: `?lpn=${ROW.lpn}` });
    const panel = await screen.findByRole("dialog", { name: ROW.lpn });
    expect(await within(panel).findByText("Túi đựng ly")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "SO-20261120-0001" })).toHaveAttribute(
      "href",
      `/admin/orders/${ORDER}`,
    );
    expect(await within(panel).findByText("Trần Minh Quang")).toBeInTheDocument();
    const history = request.mock.calls
      .map(([c]) => c)
      .find((c) => c.url === "/inventory/movements");
    expect(history?.params).toMatchObject({ lpn: ROW.lpn });
  });
});

describe("Thùng hàng (LPN) — phân quyền (UI-only, BE re-check)", () => {
  it("không có quyền trang → chặn, không gọi danh sách thùng", async () => {
    const { listCalls } = setup(["inventory-stock-packages:READ"]);
    await waitFor(() => expect(screen.queryByText("loading")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: ROW.lpn })).not.toBeInTheDocument();
    expect(listCalls()).toHaveLength(0);
  });

  it("có trang nhưng không có quyền đọc thùng → báo không có quyền, không gọi BE", async () => {
    const { listCalls } = setup(["inventory-stock-packages:VIEW_PAGE"]);
    expect(await screen.findByText(L.errorCopy.noReadDescription)).toBeInTheDocument();
    expect(listCalls()).toHaveLength(0);
  });

  it("không có quyền lịch sử → panel báo thiếu quyền, không gọi movements", async () => {
    const { request } = setup(
      MANAGER.filter((p) => p !== "inventory-stock-movements:READ"),
      { search: `?lpn=${ROW.lpn}` },
    );
    const panel = await screen.findByRole("dialog", { name: ROW.lpn });
    expect(await within(panel).findByText(L.detail.historyNoPermission)).toBeInTheDocument();
    expect(request.mock.calls.some(([c]) => c.url === "/inventory/movements")).toBe(false);
  });

  it("mở link ?lpn= của thùng không tồn tại → báo không tìm thấy thùng, không nói về bộ lọc", async () => {
    const missing = "LPN-KHONG-CO";
    setup(MANAGER, {
      search: `?lpn=${missing}`,
      respond: (config) =>
        config.url === `/inventory/stock-packages/${missing}`
          ? {
              status: 404,
              data: { success: false, errorCode: "STOCK_PACKAGE_NOT_FOUND", message: "Not found" },
            }
          : undefined,
    });
    const panel = await screen.findByRole("dialog", { name: missing });
    expect(
      await within(panel).findByText(L.detailErrorCopy.notFoundDescription),
    ).toBeInTheDocument();
    expect(within(panel).queryByText(L.errorCopy.notFoundDescription)).not.toBeInTheDocument();
  });

  it("lịch sử nhiều hơn một trang → báo chỉ hiện các dòng gần nhất", async () => {
    setup(MANAGER, {
      search: `?lpn=${ROW.lpn}`,
      respond: (config) =>
        config.url === "/inventory/movements"
          ? { status: 200, data: { ...page([MOVEMENT]), totalElements: 120, totalPages: 3 } }
          : undefined,
    });
    const panel = await screen.findByRole("dialog", { name: ROW.lpn });
    expect(await within(panel).findByText(L.detail.historyTruncated(1, 120))).toBeInTheDocument();
  });

  it('search dưới 3 ký tự không tính là đang lọc → empty "chưa có thùng", không phải "lọc không ra"', async () => {
    const { user } = setup(MANAGER, {
      respond: (config) =>
        config.url === "/inventory/stock-packages" ? { status: 200, data: page([]) } : undefined,
    });
    expect(await screen.findByText(L.emptyTitle)).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(L.searchPlaceholder), "04");
    expect(await screen.findByText(L.searchTooShort(3))).toBeInTheDocument();
    expect(screen.getByText(L.emptyTitle)).toBeInTheDocument();
    expect(screen.queryByText(L.filteredTitle)).not.toBeInTheDocument();
  });

  it("người xem bị giới hạn kho → ô lọc kho chỉ có kho được gán", async () => {
    const { user } = setup(MANAGER, { warehouses: [{ id: HCM, prefix: "HCM" }] });
    await screen.findByRole("button", { name: ROW.lpn });
    await user.click(
      screen.getByRole("button", { name: new RegExp(`Lọc ${L.column.warehouse}`, "i") }),
    );
    expect(await screen.findByText("HCM · Kho Hồ Chí Minh")).toBeInTheDocument();
    expect(screen.queryByText("BD · Kho Bình Dương")).not.toBeInTheDocument();
  });
});
