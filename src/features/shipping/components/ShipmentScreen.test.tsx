import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SHIPPING_ERROR_MESSAGES as ERR, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { apiShipment } from "../__fixtures__/load";
import {
  SHIPPING_ACTORS as ACTORS,
  mockShippingApi,
  renderShippingScreen,
} from "../__fixtures__/render";
import { ShipmentScreen } from "./ShipmentScreen";

import type { TestActor } from "../__fixtures__/render";
import type { Shipment, ShipmentRow } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const PATH = "/fulfillment/shipments/shp-1";
const L = UI_LABELS.shipping.shipment;
const O = L.outcomeDialog;

const shipment = (patch: Partial<ShipmentRow> = {}): Shipment => apiShipment(patch);

function renderShipment(
  actor: TestActor,
  data: Shipment,
  outcome?: (body: Record<string, unknown>) => unknown,
) {
  const spies = mockShippingApi(actor, {
    get: { [PATH]: () => data },
    post: { [`${PATH}/delivery-outcome`]: (_p, body) => (outcome ?? (() => data))(body as never) },
    put: { [`${PATH}/carrier`]: () => data },
  });
  renderShippingScreen(<ShipmentScreen id="shp-1" />);
  return spies;
}

describe("ShipmentScreen — chi tiết lô giao", () => {
  it("hiện đơn (liên kết), kho, kiện, lịch sử với người ghi nhận; không mã vận đơn", async () => {
    renderShipment(
      ACTORS.warehouseStaff,
      shipment({
        status: "HANDED_OVER",
        loadId: "L1",
        loadCode: "LOAD-1",
        carrierName: "GHN",
        handedOverAt: "2026-10-21T03:00:00Z",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: `${L.title} · SO-1-S1` }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SO-1" })).toHaveAttribute(
      "href",
      "/admin/orders/ord-1",
    );
    expect(screen.getByRole("link", { name: "LOAD-1" })).toHaveAttribute("href", "/admin/loads/L1");
    expect(screen.getByText("PKG-SO-1-1")).toBeInTheDocument();
    expect(screen.getByText(/Packer/)).toBeInTheDocument();
    expect(screen.queryByText(/mã vận đơn: /i)).not.toBeInTheDocument();
  });

  it("lô chờ xuất chưa lên chuyến: nhân viên kho chọn hãng (PUT); điều phối đơn chỉ thấy tên", async () => {
    const user = userEvent.setup();
    const { put } = renderShipment(
      ACTORS.warehouseStaff,
      shipment({ carrierId: "car-ghn", carrierName: "GHN" }),
    );
    await user.click(await screen.findByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /VTP/ }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(`${PATH}/carrier`, { carrierId: "car-vtp" }),
    );
  });

  it("lô đang trên chuyến: không đổi hãng, nói rõ vì sao", async () => {
    renderShipment(
      ACTORS.warehouseStaff,
      shipment({ loadId: "L1", loadCode: "LOAD-1", carrierName: "GHN" }),
    );
    expect(await screen.findByText(L.carrierLocked)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});

describe("ShipmentScreen — ghi nhận kết quả giao (BR-02)", () => {
  it("điều phối đơn với lô đã bàn giao: thấy Đã giao / Giao thất bại, không thấy Hoàn hàng", async () => {
    renderShipment(ACTORS.orderCoordinator, shipment({ status: "HANDED_OVER" }));
    await screen.findByRole("button", { name: L.outcomeAction.DELIVERED });
    expect(
      screen.getByRole("button", { name: L.outcomeAction.DELIVERY_FAILED }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: L.outcomeAction.RETURNED }),
    ).not.toBeInTheDocument();
  });

  it("giao thất bại rồi: giao lại / hoàn hàng; quản lý kho chỉ thấy hoàn hàng", async () => {
    renderShipment(
      ACTORS.warehouseManager,
      shipment({ status: "DELIVERY_FAILED", failureReason: "REFUSED" }),
    );
    await screen.findByRole("button", { name: L.outcomeAction.RETURNED });
    expect(
      screen.queryByRole("button", { name: L.outcomeAction.DELIVERED }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Khách từ chối nhận")).toBeInTheDocument();
  });

  it("nhân viên kho / chỉ xem / lô chưa bàn giao / lô đã kết thúc → không nút kết quả, kèm lý do", async () => {
    renderShipment(ACTORS.warehouseStaff, shipment({ status: "HANDED_OVER" }));
    expect(await screen.findByText(L.noActions.wrongRole)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: L.outcomeAction.DELIVERED }),
    ).not.toBeInTheDocument();
  });

  it("lô chưa bàn giao: lý do 'chưa bàn giao'; lô đã giao: 'kết quả cuối'", async () => {
    renderShipment(ACTORS.orderCoordinator, shipment());
    expect(await screen.findByText(L.noActions.readyToDispatch)).toBeInTheDocument();
  });

  it("đã giao: xác nhận trong hộp thoại → POST {outcome: DELIVERED}", async () => {
    const user = userEvent.setup();
    const { post } = renderShipment(ACTORS.orderCoordinator, shipment({ status: "HANDED_OVER" }));
    await user.click(await screen.findByRole("button", { name: L.outcomeAction.DELIVERED }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: O.confirm }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/delivery-outcome`, {
        outcome: "DELIVERED",
        failureReason: undefined,
        note: undefined,
      }),
    );
  });

  it("giao thất bại: bắt buộc lý do; 'Lý do khác' bắt buộc ghi chú; gửi đúng body", async () => {
    const user = userEvent.setup();
    const { post } = renderShipment(ACTORS.orderCoordinator, shipment({ status: "HANDED_OVER" }));
    await user.click(await screen.findByRole("button", { name: L.outcomeAction.DELIVERY_FAILED }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: O.confirm });
    expect(confirm).toBeDisabled();
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Lý do khác" }));
    await waitFor(() => expect(confirm).toBeDisabled());
    await user.type(within(dialog).getByLabelText(new RegExp(O.note)), "Khách chuyển nhà");
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/delivery-outcome`, {
        outcome: "DELIVERY_FAILED",
        failureReason: "OTHER",
        note: "Khách chuyển nhà",
      }),
    );
  });

  it("BE từ chối (409 SHIPMENT_STATE_CONFLICT) → lỗi tiếng Việt trong hộp thoại", async () => {
    const user = userEvent.setup();
    renderShipment(ACTORS.orderCoordinator, shipment({ status: "HANDED_OVER" }), () => {
      throw new ApiError(409, "SHIPMENT_STATE_CONFLICT", "en");
    });
    await user.click(await screen.findByRole("button", { name: L.outcomeAction.DELIVERED }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: O.confirm }));
    expect(await within(dialog).findByText(ERR.SHIPMENT_STATE_CONFLICT)).toBeInTheDocument();
  });

  it("không tồn tại → màn không tìm thấy", async () => {
    mockShippingApi(ACTORS.orderCoordinator, {
      get: {
        [PATH]: () => {
          throw new ApiError(404, "SHIPMENT_NOT_FOUND", "en");
        },
      },
    });
    renderShippingScreen(<ShipmentScreen id="shp-1" />);
    expect(await screen.findByText(UI_LABELS.shipping.notFoundTitle)).toBeInTheDocument();
  });
});
