import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";

import { shipmentRow } from "../__fixtures__/load";
import {
  CARRIERS,
  SHIPPING_ACTORS as ACTORS,
  bePage,
  mockShippingApi,
  renderShippingScreen,
} from "../__fixtures__/render";
import { ShipmentList } from "./ShipmentList";

import type { TestActor } from "../__fixtures__/render";
import type { ShipmentRow } from "../types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockClear();
  sessionStorage.clear();
});

const L = UI_LABELS.shipping;
const ROWS: ShipmentRow[] = [
  shipmentRow({ shipmentId: "s1", code: "SO-1-S1", orderNumber: "SO-1" }),
  shipmentRow({
    shipmentId: "s2",
    code: "SO-2-S1",
    orderNumber: "SO-2",
    carrierId: "car-ghn",
    carrierName: "Giao Hàng Nhanh",
  }),
  shipmentRow({ shipmentId: "s3", code: "SO-3-S1", orderNumber: "SO-3", warehouseId: "wh-hn" }),
];

function renderList(actor: TestActor, search = "", rows: ShipmentRow[] = ROWS) {
  const spies = mockShippingApi(actor, {
    get: { "/fulfillment/shipments": () => bePage(rows) },
  });
  renderShippingScreen(<ShipmentList />, search);
  return spies;
}

describe("ShipmentList — lô giao chờ xuất", () => {
  it("mặc định lọc lô chờ xuất của mọi kho; lọc theo kho / hãng / mã gửi đúng tham số BE", async () => {
    const { get } = renderList(ACTORS.warehouseStaff, "?warehouse=wh-hcm&carrier=car-ghn&q=SO-1");
    await screen.findByText("SO-1-S1");
    await waitFor(() => {
      const params = get.mock.calls.find(([url]) => url === "/fulfillment/shipments")?.[1]?.params;
      expect(params).toMatchObject({
        status: "READY_TO_DISPATCH",
        warehouseId: "wh-hcm",
        carrierId: "car-ghn",
        search: "SO-1",
        page: 0,
      });
    });
  });

  it("trạng thái 'Tất cả' không gửi status; cột hiện hãng, chuyến, trạng thái tiếng Việt", async () => {
    const { get } = renderList(ACTORS.warehouseStaff, "?status=ALL");
    await screen.findByText("SO-1-S1");
    const params = get.mock.calls.find(([url]) => url === "/fulfillment/shipments")?.[1]
      ?.params as Record<string, unknown>;
    expect(params.status).toBeUndefined();
    expect(screen.getAllByText("Sẵn sàng xuất").length).toBeGreaterThan(0);
  });

  it("hãng của lô chỉ là chữ (hãng của xe chở lô): không có ô chọn hãng, không có chọn lô / mở chuyến, không gọi PUT", async () => {
    const { put } = renderList(ACTORS.warehouseManager);
    await screen.findByText("SO-1-S1");
    expect(screen.getByText("Giao Hàng Nhanh")).toBeInTheDocument();
    // Các combobox còn lại là bộ lọc (trạng thái, kho, hãng) — không có ô chọn hãng theo dòng
    const table = screen.getByRole("table");
    expect(within(table).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(table).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mở chuyến/ })).not.toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it("lô chưa có hãng để trống ô hãng; lô có hãng hiện tên", async () => {
    renderList(ACTORS.warehouseStaff);
    await screen.findByText("SO-1-S1");
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    const noCarrier = rows.find((r) => within(r).queryByText("SO-1-S1"));
    const withCarrier = rows.find((r) => within(r).queryByText("SO-2-S1"));
    expect(within(noCarrier as HTMLElement).queryByText("Giao Hàng Nhanh")).not.toBeInTheDocument();
    expect(within(withCarrier as HTMLElement).getByText("Giao Hàng Nhanh")).toBeInTheDocument();
  });

  it("không có cột / chữ thu hộ (COD): lô dù BE gửi thêm trường cũ cũng không hiện", async () => {
    renderList(ACTORS.warehouseStaff);
    await screen.findByText("SO-1-S1");
    expect(screen.queryByText(/thu hộ|COD/i)).not.toBeInTheDocument();
  });

  it.each([
    ["nhân viên kho", ACTORS.warehouseStaff],
    ["quản lý kho", ACTORS.warehouseManager],
    ["điều phối đơn", ACTORS.orderCoordinator],
    ["chỉ xem", ACTORS.viewOnly],
  ])(
    "%s (có quyền đọc) thấy cùng một bảng chỉ đọc; bấm nút xem dòng → sang chi tiết lô",
    async (_n, actor) => {
      const user = userEvent.setup();
      renderList(actor);
      expect(await screen.findByRole("link", { name: "SO-1-S1" })).toHaveAttribute(
        "href",
        "/admin/shipments/s1",
      );
      await user.click(screen.getByRole("button", { name: `${L.shipments.title} SO-1-S1` }));
      expect(push).toHaveBeenCalledWith("/admin/shipments/s1");
    },
  );

  it("hãng ngừng / lọc theo hãng trong bộ lọc: chọn hãng gửi carrierId cho BE", async () => {
    const user = userEvent.setup();
    const { get } = renderList(ACTORS.warehouseStaff);
    await screen.findByText("SO-1-S1");
    await user.click(screen.getByRole("combobox", { name: L.shipments.carrierFilter }));
    await user.click(
      await screen.findByRole("option", { name: new RegExp(CARRIERS[1]?.code ?? "VTP") }),
    );
    await waitFor(() => {
      const calls = get.mock.calls.filter(([url]) => url === "/fulfillment/shipments");
      expect(calls.at(-1)?.[1]?.params).toMatchObject({ carrierId: "car-vtp" });
    });
  });

  it("danh sách rỗng: 'chưa có lô' khác 'lọc không ra kết quả'", async () => {
    renderList(ACTORS.warehouseStaff, "", []);
    expect(await screen.findByText(L.shipments.empty.noDataTitle)).toBeInTheDocument();
  });

  it("danh sách rỗng khi đang lọc → 'không có kết quả', không phải 'chưa có lô'", async () => {
    renderList(ACTORS.warehouseStaff, "?q=KHONG-CO", []);
    expect(await screen.findByText(UI_LABELS.emptyList.noResultsTitle)).toBeInTheDocument();
    expect(screen.queryByText(L.shipments.empty.noDataTitle)).not.toBeInTheDocument();
  });

  it("không có quyền đọc → màn từ chối, không gọi API danh sách", async () => {
    const { get } = renderList(ACTORS.noAccess);
    expect(await screen.findByText(L.forbiddenDescription)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === "/fulfillment/shipments")).toBe(false);
  });
});
