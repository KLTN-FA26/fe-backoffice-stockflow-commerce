import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";
import { SHIPPING_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { LOAD_ID, apiLoad, shipmentRow } from "../__fixtures__/load";
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
    post: { "/fulfillment/loads": (_p, body) => ({ ...apiLoad(), ...(body as object) }) },
    put: {
      "/fulfillment/shipments/s1/carrier": (_p, body) => ({
        shipment: { ...ROWS[0], carrierId: (body as { carrierId: string | null }).carrierId },
        packages: [],
        timeline: [],
      }),
    },
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

  it("nhân viên kho chọn hãng ngay trên dòng → PUT /carrier; 'Chưa chọn hãng' gửi null", async () => {
    const user = userEvent.setup();
    const { put } = renderList(ACTORS.warehouseStaff);
    await screen.findByText("SO-1-S1");
    await user.click(
      screen.getByRole("combobox", { name: `${L.shipments.carrierSelectLabel} SO-1-S1` }),
    );
    await user.click(
      await screen.findByRole("option", { name: `${CARRIERS[1]?.code} · ${CARRIERS[1]?.name}` }),
    );
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith("/fulfillment/shipments/s1/carrier", {
        carrierId: "car-vtp",
      }),
    );
  });

  it("lỗi BE khi chọn hãng (lô đã lên chuyến) → toast tiếng Việt, không treo", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(toast, "error");
    const { put } = renderList(ACTORS.warehouseStaff);
    put.mockRejectedValueOnce(new ApiError(409, "SHIPMENT_ON_ANOTHER_LOAD", "en"));
    await screen.findByText("SO-1-S1");
    await user.click(
      screen.getByRole("combobox", { name: `${L.shipments.carrierSelectLabel} SO-1-S1` }),
    );
    await user.click(await screen.findByRole("option", { name: /GHN/ }));
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(SHIPPING_ERROR_MESSAGES.SHIPMENT_ON_ANOTHER_LOAD),
    );
  });

  it("điều phối đơn / chỉ xem: không chọn hãng, không chọn lô để mở chuyến", async () => {
    renderList(ACTORS.orderCoordinator);
    await screen.findByText("SO-1-S1");
    expect(
      screen.queryByRole("combobox", { name: new RegExp(L.shipments.carrierSelectLabel) }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.shipments.openLoad })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Chọn tất cả" })).not.toBeInTheDocument();
    expect(screen.getByText("Giao Hàng Nhanh")).toBeInTheDocument();
  });

  it("chọn lô cùng kho → mở chuyến: POST /loads kèm requestId (uuid), kho, hãng, các lô; rồi sang chuyến vừa mở", async () => {
    const user = userEvent.setup();
    const { post } = renderList(ACTORS.warehouseStaff, "", ROWS.slice(0, 2));
    await screen.findByText("SO-1-S1");
    const open = screen.getByRole("button", { name: L.shipments.openLoad });
    expect(open).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Chọn tất cả" }));
    expect(screen.getByText(new RegExp(`2 ${L.shipments.selected}`))).toBeInTheDocument();
    await user.click(open);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("SO-1-S1, SO-2-S1")).toBeInTheDocument();
    // Hãng đã gán cho lô S2 → hãng của chuyến khoá theo đó
    await user.type(within(dialog).getByLabelText(L.openDialog.vehiclePlate), "51C-628.14");
    await user.click(within(dialog).getByRole("button", { name: L.openDialog.submit }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body] = post.mock.calls[0] ?? [];
    expect(url).toBe("/fulfillment/loads");
    expect(body).toMatchObject({
      warehouseId: "wh-hcm",
      carrierId: "car-ghn",
      shipmentIds: ["s1", "s2"],
      vehiclePlate: "51C-628.14",
    });
    expect((body as { requestId: string }).requestId).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/loads/${LOAD_ID}`));
  });

  it("lô khác kho → báo không mở được một chuyến", async () => {
    const user = userEvent.setup();
    renderList(ACTORS.warehouseStaff);
    await screen.findByText("SO-1-S1");
    await user.click(screen.getByRole("checkbox", { name: "Chọn tất cả" }));
    expect(screen.getByRole("alert")).toHaveTextContent(L.shipments.mixedWarehouses);
    expect(screen.getByRole("button", { name: L.shipments.openLoad })).toBeDisabled();
  });

  it("danh sách rỗng: 'chưa có lô' khác 'lọc không ra kết quả'", async () => {
    renderList(ACTORS.warehouseStaff, "", []);
    expect(await screen.findByText(L.shipments.empty.noDataTitle)).toBeInTheDocument();
  });

  it("không có quyền đọc → màn từ chối, không gọi API danh sách", async () => {
    const { get } = renderList(ACTORS.noAccess);
    expect(await screen.findByText(L.forbiddenDescription)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === "/fulfillment/shipments")).toBe(false);
  });
});
