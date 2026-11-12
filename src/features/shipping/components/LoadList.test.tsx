import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_ROUTES,
  FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS,
  SHIPMENT_PERMISSIONS,
  UI_LABELS,
} from "@/constants";

import { ftlRow } from "../__fixtures__/ftl-load";
import { LOAD_ID } from "../__fixtures__/load";
import {
  SHIPPING_ACTORS as ACTORS,
  bePage,
  mockShippingApi,
  renderShippingScreen,
} from "../__fixtures__/render";
import { LoadList } from "./LoadList";

import type { TestActor } from "../__fixtures__/render";
import type { LoadRow } from "../types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockClear();
  sessionStorage.clear();
});

const L = UI_LABELS.shipping;
const ROW: LoadRow = {
  loadId: LOAD_ID,
  code: LOAD_ID,
  warehouseId: "wh-hcm",
  status: "LOADING",
  carrierId: "car-ghn",
  carrierName: "Giao Hàng Nhanh",
  vehiclePlate: "51C-628.14",
  driverName: "Lê Văn Xế",
  shipmentCount: 2,
  packageCount: 1,
  waybillNo: "GHN-250001",
  version: 4,
};

function renderList(actor: TestActor, search = "", rows: LoadRow[] = [ROW]) {
  const spies = mockShippingApi(actor, {
    get: { "/fulfillment/loads": () => bePage(rows) },
  });
  renderShippingScreen(<LoadList />, search);
  return spies;
}

describe("LoadList — chuyến xe", () => {
  it("hiện chuyến với hãng, xe + tài xế, số lô, kiện đã lên xe; lọc gửi đúng tham số BE (một trạng thái)", async () => {
    const { get } = renderList(
      ACTORS.warehouseStaff,
      "?status=LOADING&warehouse=wh-hcm&carrier=car-ghn&q=51C",
    );
    expect(await screen.findByRole("link", { name: LOAD_ID })).toHaveAttribute(
      "href",
      `/admin/loads/${LOAD_ID}`,
    );
    expect(screen.getByText("Giao Hàng Nhanh")).toBeInTheDocument();
    expect(screen.getByText("51C-628.14")).toBeInTheDocument();
    expect(screen.getByText("Lê Văn Xế")).toBeInTheDocument();
    await waitFor(() => {
      const params = get.mock.calls.find(([url]) => url === "/fulfillment/loads")?.[1]?.params;
      expect(params).toMatchObject({
        status: "LOADING",
        warehouseId: "wh-hcm",
        carrierId: "car-ghn",
        search: "51C",
      });
    });
  });

  it("không còn bộ lọc / cột hình thức và không có nút mở chuyến: không gửi `mode` cho BE", async () => {
    const { get } = renderList(ACTORS.warehouseManager);
    await screen.findByRole("link", { name: LOAD_ID });
    // Còn các bộ lọc trạng thái, kho, hãng; không có bộ lọc hình thức
    for (const name of [
      L.shipments.statusFilter,
      L.shipments.warehouseFilter,
      L.shipments.carrierFilter,
    ]) {
      expect(screen.getByRole("combobox", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("combobox", { name: /Hình thức/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /Hình thức/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mở chuyến" })).not.toBeInTheDocument();
    const params = get.mock.calls.find(([url]) => url === "/fulfillment/loads")?.[1]?.params;
    expect(params).not.toHaveProperty("mode");
  });

  it("mở chuyến bằng nút xem ở cuối dòng → sang chi tiết chuyến", async () => {
    const user = userEvent.setup();
    renderList(ACTORS.warehouseStaff);
    await user.click(await screen.findByRole("button", { name: `${L.loads.openRow} ${LOAD_ID}` }));
    expect(push).toHaveBeenCalledWith(ADMIN_ROUTES.loads.detail(LOAD_ID));
  });

  it("danh sách rỗng: 'chưa có chuyến' khác 'lọc không ra kết quả'", async () => {
    renderList(ACTORS.warehouseStaff, "", []);
    expect(await screen.findByText(L.loads.empty.noDataTitle)).toBeInTheDocument();
  });
});

describe("LoadList — tìm kiếm", () => {
  it("ô tìm kiếm nói rõ tìm theo mã chuyến, biển số và mã kế hoạch; gửi `search` cho BE", async () => {
    const { get } = renderList(ACTORS.warehouseStaff, "?q=LP-2026");
    const box = await screen.findByPlaceholderText(/mã kế hoạch/);
    expect(box).toHaveAttribute("placeholder", L.loads.searchPlaceholder);
    expect(L.loads.searchScope).toMatch(/mã kế hoạch/);
    await waitFor(() => {
      const params = get.mock.calls.find(([url]) => url === "/fulfillment/loads")?.[1]?.params;
      expect(params).toMatchObject({ search: "LP-2026" });
    });
  });
});

describe("LoadList — chuyến của kế hoạch xếp xe (BE PR #162)", () => {
  const FTL = ftlRow({ loadId: "LD-F001", code: "LD-F001", status: "VEHICLE_BOOKED" });
  const PLANNED = ftlRow({
    loadId: "LD-F002",
    code: "LD-F002",
    status: "PLANNED",
    vehicleSeq: 2,
    carrierId: undefined,
    carrierName: undefined,
  });

  it("mỗi dòng hiện mã kế hoạch (liên kết) + số xe, trạng thái Đã lập kế hoạch / Đã đặt xe", async () => {
    renderList(ACTORS.warehouseStaff, "", [FTL, PLANNED]);
    await screen.findByRole("link", { name: "LD-F001" });
    const planLinks = screen.getAllByRole("link", { name: "LP-2026-0001" });
    expect(planLinks).toHaveLength(2);
    expect(planLinks[0]).toHaveAttribute("href", "/admin/load-plans/lp-1");
    expect(screen.getByText(`${L.ftl.vehicleSeq} 1`)).toBeInTheDocument();
    expect(screen.getByText(`${L.ftl.vehicleSeq} 2`)).toBeInTheDocument();
    expect(screen.getByText("Đã đặt xe")).toBeInTheDocument();
    expect(screen.getByText("Đã lập kế hoạch")).toBeInTheDocument();
  });

  it("server phân trang: sang trang sau gửi page=1 và giữ bộ lọc đang chọn", async () => {
    const user = userEvent.setup();
    const { get } = mockShippingApi(ACTORS.warehouseStaff, {
      get: {
        "/fulfillment/loads": (params) => {
          const page = (params as { page?: number }).page ?? 0;
          return {
            ...bePage([page === 0 ? FTL : PLANNED], page),
            totalElements: 2,
            totalPages: 2,
            hasNext: page === 0,
          };
        },
      },
    });
    renderShippingScreen(<LoadList />, "?status=VEHICLE_BOOKED");
    await screen.findByRole("link", { name: "LD-F001" });
    await user.click(screen.getByRole("button", { name: "Sau" }));
    expect(await screen.findByRole("link", { name: "LD-F002" })).toBeInTheDocument();
    const second = get.mock.calls
      .filter(([url]) => url === "/fulfillment/loads")
      .map(([, c]) => c?.params as { page?: number; status?: string })
      .find((p) => p.page === 1);
    expect(second?.status).toBe("VEHICLE_BOOKED");
  });

  it("BE không có chuyến nào khi đang lọc → 'không có kết quả', khác 'chưa có chuyến'", async () => {
    renderList(ACTORS.warehouseStaff, "?status=LOADING", []);
    expect(await screen.findByText(UI_LABELS.emptyList.noResultsTitle)).toBeInTheDocument();
    expect(screen.queryByText(L.loads.empty.noDataTitle)).not.toBeInTheDocument();
  });

  it("bộ lọc trạng thái có Đã lập kế hoạch và Đã đặt xe; gửi đúng một trạng thái cho BE", async () => {
    const user = userEvent.setup();
    const { get } = renderList(ACTORS.warehouseStaff, "", [FTL]);
    await screen.findByRole("link", { name: "LD-F001" });
    await user.click(screen.getByRole("combobox", { name: L.shipments.statusFilter }));
    expect(await screen.findByRole("option", { name: "Đã lập kế hoạch" })).toBeInTheDocument();
    await user.click(await screen.findByRole("option", { name: "Đã đặt xe" }));
    await waitFor(() => {
      const calls = get.mock.calls.filter(([url]) => url === "/fulfillment/loads");
      expect(calls.at(-1)?.[1]?.params).toMatchObject({ status: "VEHICLE_BOOKED" });
    });
  });
});

describe("LoadList — cột Mã vận đơn (BR-23)", () => {
  it("có cột Mã vận đơn: chuyến đã có mã hiện mã, chuyến chưa có mã để trống", async () => {
    renderList(ACTORS.warehouseStaff, "", [
      ROW,
      ftlRow({ loadId: "LD-F001", code: "LD-F001", waybillNo: undefined }),
    ]);
    await screen.findByRole("link", { name: "LD-F001" });
    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader");
    const index = headers.findIndex((h) => h.textContent === L.loads.waybillColumn);
    expect(index).toBeGreaterThanOrEqual(0);
    const rows = within(table).getAllByRole("row");
    const withCode = rows.find((r) => within(r).queryByRole("link", { name: LOAD_ID }));
    const without = rows.find((r) => within(r).queryByRole("link", { name: "LD-F001" }));
    expect(within(withCode as HTMLElement).getByText("GHN-250001")).toBeInTheDocument();
    expect(within(without as HTMLElement).queryByText("GHN-250001")).not.toBeInTheDocument();
    expect(within(without as HTMLElement).getAllByRole("cell")[index]).toHaveTextContent(/^\s*$|—/);
  });
});

describe("LoadList — nhập mã vận đơn từ file (gate theo quyền)", () => {
  it.each([
    ["nhân viên kho", ACTORS.warehouseStaff],
    ["quản lý kho", ACTORS.warehouseManager],
  ])(
    "%s (fulfillment-waybill-imports:CREATE) thấy liên kết dẫn tới trang nhập",
    async (_n, actor) => {
      renderList(actor);
      await screen.findByRole("link", { name: LOAD_ID });
      expect(screen.getByRole("link", { name: L.loads.importWaybills })).toHaveAttribute(
        "href",
        ADMIN_ROUTES.loads.waybillImport,
      );
    },
  );

  it.each([
    ["điều phối đơn", ACTORS.orderCoordinator],
    ["chỉ xem", ACTORS.viewOnly],
  ])("%s không có quyền CREATE → không có liên kết", async (_n, actor) => {
    renderList(actor);
    await screen.findByRole("link", { name: LOAD_ID });
    expect(screen.queryByRole("link", { name: L.loads.importWaybills })).not.toBeInTheDocument();
  });

  it("chỉ có READ của nhập mã vận đơn (không CREATE) → không có liên kết", async () => {
    renderList({
      permissions: [
        SHIPMENT_PERMISSIONS.viewPage,
        SHIPMENT_PERMISSIONS.read,
        FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS.read,
      ],
    });
    await screen.findByRole("link", { name: LOAD_ID });
    expect(screen.queryByRole("link", { name: L.loads.importWaybills })).not.toBeInTheDocument();
  });

  it("chỉ có viewPage + CREATE (không đọc được danh sách) → vẫn có liên kết, không có bộ lọc", async () => {
    renderList({
      permissions: [SHIPMENT_PERMISSIONS.viewPage, FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS.create],
    });
    expect(await screen.findByRole("link", { name: L.loads.importWaybills })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(L.loads.searchPlaceholder)).not.toBeInTheDocument();
  });

  it("không có quyền xem trang → không thấy danh sách lẫn liên kết", async () => {
    renderList(ACTORS.noAccess);
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: L.loads.importWaybills })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("link", { name: LOAD_ID })).not.toBeInTheDocument();
  });
});
