import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PERMISSION_QUERY } from "@/constants/permissions";
import { UI_LABELS } from "@/constants";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import { WarehouseCapacityDetail } from "../components/WarehouseCapacityDetail";
import { WarehouseCapacityList } from "../components/WarehouseCapacityList";
import { fullBoardJson, hcmWarehouseJson, roomyBoardJson } from "./fixtures";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const L = UI_LABELS.warehouseCapacity;

/** Quyền theo seed BE V20261125000100 — Quản lý kho có thêm sửa kho; Sale chỉ xem. */
const PERMISSIONS = {
  WAREHOUSE_MANAGER: [
    "warehouse-capacity:VIEW_PAGE",
    "warehouse-capacity:READ",
    "warehouse-warehouses:READ",
    "warehouse-warehouses:UPDATE",
    "warehouse-locations:READ",
  ],
  SALES_STAFF: ["warehouse-capacity:VIEW_PAGE", "warehouse-capacity:READ"],
  WAREHOUSE_STAFF: ["warehouse-capacity:VIEW_PAGE"],
} as const;
type Role = keyof typeof PERMISSIONS;

function mockApi(role: Role) {
  const get = vi.spyOn(api, "get").mockImplementation(async (url: string) => {
    if (url === PERMISSION_QUERY.path)
      return { data: { roles: [role], permissions: [...PERMISSIONS[role]], dataScope: "ALL" } };
    if (url === "/warehouse-capacity") return { data: [roomyBoardJson, fullBoardJson] };
    if (url === "/warehouse-capacity/wh-hcm") return { data: roomyBoardJson };
    if (url === "/warehouses/wh-hcm") return { data: hcmWarehouseJson };
    throw new Error(`Không có mock cho GET ${url}`);
  });
  const put = vi.spyOn(api, "put").mockImplementation(async (_url: string, body: unknown) => ({
    data: { ...hcmWarehouseJson, ...(body as object), version: 8 },
  }));
  return { get, put };
}

function renderAs(role: Role, ui: React.ReactElement, searchParams = "") {
  useAuthStore.setState({
    user: {
      userId: "u-test",
      fullName: "Test",
      email: "t@example.com",
      roles: [role],
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
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={searchParams} hasMemory>
        <Suspense fallback={<div>loading</div>}>{ui}</Suspense>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  push.mockReset();
});

describe("Bảng sức chứa — danh sách kho (docs 06 §4.6 bước 3)", () => {
  it("một dòng mỗi kho, còn trống âm tô đỏ; bấm dòng → chi tiết theo prefix", async () => {
    mockApi("SALES_STAFF");
    renderAs("SALES_STAFF", <WarehouseCapacityList />);
    const table = await screen.findByRole("table");
    expect(within(table).getByText("HCM01")).toBeInTheDocument();
    expect(within(table).getByText("-20")).toHaveClass("text-danger");
    await userEvent.click(within(table).getByText("Kho Thủ Đức"));
    expect(push).toHaveBeenCalledWith("/admin/warehouse-capacity/HCM01");
  });

  it("search trên URL lọc tại chỗ; không khớp → empty 'không tìm thấy' có nút bỏ lọc", async () => {
    mockApi("SALES_STAFF");
    renderAs("SALES_STAFF", <WarehouseCapacityList />, "?q=long biên");
    const table = await screen.findByRole("table");
    expect(within(table).queryByText("HCM01")).not.toBeInTheDocument();
    expect(within(table).getByText("HN01")).toBeInTheDocument();
    await userEvent.clear(screen.getByPlaceholderText(L.searchPlaceholder));
    await userEvent.type(screen.getByPlaceholderText(L.searchPlaceholder), "zzz");
    expect(await screen.findByText(L.empty.noResultsDescription)).toBeInTheDocument();
  });

  it("có trang nhưng thiếu quyền READ → báo không có quyền, không gọi API bảng", async () => {
    const { get } = mockApi("WAREHOUSE_STAFF");
    renderAs("WAREHOUSE_STAFF", <WarehouseCapacityList />);
    expect(await screen.findByText(L.noReadTitle)).toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith("/warehouse-capacity", expect.anything());
  });
});

describe("Bảng sức chứa — chi tiết một kho (docs 06 §4.6 bước 4)", () => {
  it("Quản lý kho: thấy nút sửa hệ số và mở bản đồ; xem theo zone / kệ / khu", async () => {
    mockApi("WAREHOUSE_MANAGER");
    renderAs("WAREHOUSE_MANAGER", <WarehouseCapacityDetail prefix="HCM01" />);
    expect(await screen.findByRole("button", { name: L.editFactor })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: L.openMap })).toHaveAttribute(
      "href",
      "/admin/warehouse-map/HCM01",
    );
    const zones = screen.getByRole("tabpanel");
    expect(within(zones).getByText("Zone A")).toBeInTheDocument();
    expect(within(zones).getByText("Không thuộc zone")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /Khu vực/ }));
    // BR-19: khu vực chỉ có cột Đang chiếm
    const areas = screen.getByRole("tabpanel");
    expect(within(areas).getByText("RCV01")).toBeInTheDocument();
    expect(within(areas).queryByText(`${L.column.capacity} (${L.unitM3})`)).not.toBeInTheDocument();
  });

  it("Sale: chỉ xem — không có nút sửa hệ số", async () => {
    mockApi("SALES_STAFF");
    renderAs("SALES_STAFF", <WarehouseCapacityDetail prefix="HCM01" />);
    expect(await screen.findByText(L.general)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.editFactor })).not.toBeInTheDocument();
  });

  it("kho thiếu chỗ: cảnh báo còn trống âm và số liệu thiếu kích thước (BR-21, C40)", async () => {
    mockApi("SALES_STAFF");
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === PERMISSION_QUERY.path)
        return {
          data: {
            roles: ["SALES_STAFF"],
            permissions: [...PERMISSIONS.SALES_STAFF],
            dataScope: "ALL",
          },
        };
      if (url === "/warehouse-capacity") return { data: [fullBoardJson] };
      if (url === "/warehouse-capacity/wh-hn") return { data: fullBoardJson };
      throw new Error(`Không có mock cho GET ${url}`);
    });
    renderAs("SALES_STAFF", <WarehouseCapacityDetail prefix="HN01" />);
    expect(await screen.findByText(L.warning.negativeTitle)).toBeInTheDocument();
    expect(screen.getByText(L.warning.binsWithoutVolume(3))).toBeInTheDocument();
    expect(screen.getByText(L.warning.productionCartonsWithoutSize(6))).toBeInTheDocument();
  });

  it("prefix không có trong bảng → 'không tìm thấy kho'", async () => {
    mockApi("SALES_STAFF");
    renderAs("SALES_STAFF", <WarehouseCapacityDetail prefix="DN09" />);
    expect(await screen.findByText(L.notFoundTitle)).toBeInTheDocument();
  });

  it("sửa hệ số: chặn 0%, lưu 90% gửi lại đủ trường kho + version, hệ số 0.9", async () => {
    const { put } = mockApi("WAREHOUSE_MANAGER");
    renderAs("WAREHOUSE_MANAGER", <WarehouseCapacityDetail prefix="HCM01" />);
    await userEvent.click(await screen.findByRole("button", { name: L.editFactor }));
    const input = await screen.findByLabelText(
      new RegExp(L.factorDialog.field.replace(/[()%]/g, ".")),
    );
    expect(input).toHaveValue("85");
    await userEvent.clear(input);
    await userEvent.type(input, "0");
    expect(await screen.findByText(L.validation.factorRange)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.factorDialog.submit })).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, "90");
    await userEvent.click(screen.getByRole("button", { name: L.factorDialog.submit }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith("/warehouses/wh-hcm", {
        name: "Kho Thủ Đức",
        address: "Thủ Đức, TP. Hồ Chí Minh",
        returnAddress: undefined,
        mapWidth: 60,
        mapHeight: 40,
        version: 7,
        utilizationFactor: 0.9,
      }),
    );
  });
});
