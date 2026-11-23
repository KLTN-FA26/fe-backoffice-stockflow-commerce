import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SHIPPING_DELIVERY_TIME_MESSAGES as DT,
  SHIPPING_ERROR_MESSAGES as ERR,
  UI_LABELS,
} from "@/constants";
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
const C = L.correction;

const shipment = (patch: Partial<ShipmentRow> = {}): Shipment => apiShipment(patch);

function renderShipment(
  actor: TestActor,
  data: Shipment,
  outcome?: (body: Record<string, unknown>) => unknown,
  correction?: (body: Record<string, unknown>) => unknown,
) {
  const spies = mockShippingApi(actor, {
    get: { [PATH]: () => data },
    post: {
      [`${PATH}/delivery-outcome`]: (_p, body) => (outcome ?? (() => data))(body as never),
      [`${PATH}/delivery-outcome-correction`]: (_p, body) =>
        (correction ?? (() => data))(body as never),
    },
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

  it.each([
    ["nhân viên kho", ACTORS.warehouseStaff],
    ["quản lý kho", ACTORS.warehouseManager],
    ["điều phối đơn", ACTORS.orderCoordinator],
  ])(
    "%s: hãng chỉ là chữ (hãng của xe chở lô), không có ô chọn hãng, không gọi PUT",
    async (_n, actor) => {
      const { put } = renderShipment(actor, shipment({ carrierId: "car-ghn", carrierName: "GHN" }));
      await screen.findByRole("heading", { name: `${L.title} · SO-1-S1` });
      expect(screen.getByText("GHN")).toBeInTheDocument();
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
      expect(put).not.toHaveBeenCalled();
    },
  );

  it("lô chưa có xe / hãng: hiện 'Chưa chọn hãng', không có liên kết chuyến", async () => {
    renderShipment(ACTORS.warehouseStaff, shipment());
    await screen.findByRole("heading", { name: `${L.title} · SO-1-S1` });
    expect(screen.getByText(UI_LABELS.shipping.field.carrierNone)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /LOAD-/ })).not.toBeInTheDocument();
  });

  it("kiện chỉ hiện mã + trạng thái + cân nặng: không còn nhãn 'Cần in lại nhãn' hay chữ thu hộ", async () => {
    renderShipment(ACTORS.warehouseStaff, shipment());
    await screen.findByText("PKG-SO-1-1");
    expect(screen.queryByText(/in lại nhãn/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/thu hộ|COD/i)).not.toBeInTheDocument();
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

  it("giao thất bại rồi: quản lý kho (UPDATE + APPROVE, seed BE) thấy giao lại / hoàn hàng", async () => {
    renderShipment(
      ACTORS.warehouseManagerFull,
      shipment({ status: "DELIVERY_FAILED", failureReason: "REFUSED" }),
    );
    await screen.findByRole("button", { name: L.outcomeAction.RETURNED });
    expect(screen.getByRole("button", { name: L.outcomeAction.DELIVERED })).toBeInTheDocument();
    expect(screen.getByText("Khách từ chối nhận")).toBeInTheDocument();
  });

  it("WF-05 BO-05 (C-5): hộp thoại hàng hoàn về nói rõ phần hàng bị đóng, tiền tính lúc xác nhận phiếu, gửi lại = đơn mới", async () => {
    renderShipment(
      ACTORS.warehouseManagerFull,
      shipment({ status: "DELIVERY_FAILED", failureReason: "REFUSED" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: L.outcomeAction.RETURNED }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/bị đóng khỏi đơn/)).toBeInTheDocument();
    expect(within(dialog).getByText(/xác nhận phiếu nhận hàng hoàn/)).toBeInTheDocument();
    expect(within(dialog).getByText(/tạo đơn mới/)).toBeInTheDocument();
    expect(within(dialog).getByText(/không sửa lại được/)).toBeInTheDocument();
  });

  it("WF-05 BO-05 (Q-7, F-6): chỉ có delivery-outcomes:UPDATE → KHÔNG ghi được hàng hoàn về, nói cần quyền phê duyệt", async () => {
    renderShipment(
      ACTORS.warehouseManager,
      shipment({ status: "DELIVERY_FAILED", failureReason: "REFUSED" }),
    );
    expect(await screen.findByText(L.noActions.needsApproval)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: L.outcomeAction.RETURNED }),
    ).not.toBeInTheDocument();
  });

  it("nhân viên kho / chỉ xem / lô chưa bàn giao / lô đã kết thúc → không nút kết quả, kèm lý do", async () => {
    renderShipment(ACTORS.warehouseStaff, shipment({ status: "HANDED_OVER" }));
    expect(await screen.findByText(L.noActions.viewOnly)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: L.outcomeAction.DELIVERED }),
    ).not.toBeInTheDocument();
  });

  it("chỉ xem: lô đã bàn giao không có nút kết quả nào, kèm lý do", async () => {
    renderShipment(ACTORS.viewOnly, shipment({ status: "HANDED_OVER" }));
    expect(await screen.findByText(L.noActions.viewOnly)).toBeInTheDocument();
    for (const outcome of ["DELIVERED", "DELIVERY_FAILED", "RETURNED"] as const) {
      expect(
        screen.queryByRole("button", { name: L.outcomeAction[outcome] }),
      ).not.toBeInTheDocument();
    }
  });

  it("không có quyền xem trang → không gọi API chi tiết lô", async () => {
    const { get } = renderShipment(ACTORS.noAccess, shipment({ status: "HANDED_OVER" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: L.outcomeAction.DELIVERED }),
      ).not.toBeInTheDocument(),
    );
    expect(get.mock.calls.some(([url]) => url === PATH)).toBe(false);
  });

  it("quản lý kho (chỉ delivery-outcomes:UPDATE) thấy lô HANDED_OVER: không nút kết quả, nói cần quyền phê duyệt", async () => {
    renderShipment(ACTORS.warehouseManager, shipment({ status: "HANDED_OVER" }));
    expect(await screen.findByText(L.noActions.needsApproval)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: L.outcomeAction.DELIVERED }),
    ).not.toBeInTheDocument();
  });

  it("lô chưa bàn giao: lý do 'chưa bàn giao'; lô đã giao: 'kết quả cuối'", async () => {
    renderShipment(ACTORS.orderCoordinator, shipment());
    expect(await screen.findByText(L.noActions.readyToDispatch)).toBeInTheDocument();
  });

  it("ghi chú chỉ có ở lần giao thất bại (BE không lưu ghi chú của kết quả khác)", async () => {
    const user = userEvent.setup();
    renderShipment(ACTORS.orderCoordinator, shipment({ status: "HANDED_OVER" }));
    await user.click(await screen.findByRole("button", { name: L.outcomeAction.DELIVERED }));
    expect(within(screen.getByRole("dialog")).queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Huỷ" }));
    await user.click(await screen.findByRole("button", { name: L.outcomeAction.DELIVERY_FAILED }));
    expect(within(screen.getByRole("dialog")).getByRole("textbox")).toBeInTheDocument();
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
    await user.click(within(dialog).getByRole("radio", { name: "Lý do khác" }));
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

describe("ShipmentScreen — hộp thoại ghi nhận theo artboard", () => {
  const handedOver = () =>
    shipment({
      status: "HANDED_OVER",
      carrierName: "Ahamove",
      loadId: "L1",
      loadCode: "LD-1",
      handedOverAt: "2026-10-21T03:00:00Z",
    });

  it("đã giao: có bảng tóm tắt đơn / hãng / chuyến / số kiện kèm cân nặng, và dòng lưu người ghi nhận", async () => {
    const user = userEvent.setup();
    renderShipment(ACTORS.orderCoordinator, handedOver());
    await user.click(await screen.findByRole("button", { name: L.outcomeAction.DELIVERED }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(O.summary.order)).toBeInTheDocument();
    expect(within(dialog).getByText("SO-1")).toBeInTheDocument();
    expect(within(dialog).getByText("Ahamove")).toBeInTheDocument();
    expect(within(dialog).getByText("LD-1")).toBeInTheDocument();
    // hai kiện 1,5 + 0,8 kg
    expect(within(dialog).getByText(/2 kiện · 2,3 kg/)).toBeInTheDocument();
    expect(within(dialog).getByText(O.audit)).toBeInTheDocument();
  });

  it("giao thất bại: sáu thẻ lý do hiện sẵn, không có bảng tóm tắt", async () => {
    const user = userEvent.setup();
    renderShipment(ACTORS.orderCoordinator, handedOver());
    await user.click(await screen.findByRole("button", { name: L.outcomeAction.DELIVERY_FAILED }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("radio")).toHaveLength(6);
    expect(within(dialog).queryByText(O.summary.order)).not.toBeInTheDocument();
  });

  it("lô giao thất bại ghi nhận đã giao (giao lại): nêu kết quả hiện tại và lý do", async () => {
    const user = userEvent.setup();
    renderShipment(
      ACTORS.orderCoordinator,
      shipment({ status: "DELIVERY_FAILED", failureReason: "CUSTOMER_ABSENT" }),
    );
    await user.click(await screen.findByRole("button", { name: L.outcomeAction.DELIVERED }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(O.summary.currentResult)).toBeInTheDocument();
    expect(within(dialog).getByText(/Khách vắng mặt/)).toBeInTheDocument();
  });
});

describe("ShipmentScreen — thời điểm giao khi ghi tay (docs 09 §4.3 bước 2)", () => {
  const handedOver = () =>
    shipment({ status: "HANDED_OVER", handedOverAt: "2026-10-21T03:00:00Z" });

  async function openDelivered(actor: TestActor = ACTORS.orderCoordinator, data = handedOver()) {
    const user = userEvent.setup();
    const spies = renderShipment(actor, data);
    await user.click(await screen.findByRole("button", { name: L.outcomeAction.DELIVERED }));
    const dialog = screen.getByRole("dialog");
    return { user, dialog, post: spies.post, time: within(dialog).getByLabelText(O.deliveredAt) };
  }

  it("có ô thời điểm giao, mặc định bây giờ; chặn từ lúc bàn giao (giờ Việt Nam) đến bây giờ", async () => {
    const { dialog, time } = await openDelivered();
    expect(time).toHaveAttribute("type", "datetime-local");
    expect(time).toHaveAttribute("min", "2026-10-21T10:00");
    expect((time as HTMLInputElement).value).toBe(time.getAttribute("max"));
    expect(within(dialog).getByText(O.deliveredAtHint)).toBeInTheDocument();
  });

  it("không đụng vào ô → không gửi deliveredAt (BE lấy lúc ghi nhận)", async () => {
    const { user, dialog, post } = await openDelivered();
    await user.click(within(dialog).getByRole("button", { name: O.confirm }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0]?.[1]).not.toHaveProperty("deliveredAt", expect.any(String));
  });

  it("nhập giờ hãng báo → gửi Instant ISO của giờ Việt Nam", async () => {
    const { user, dialog, post, time } = await openDelivered();
    fireEvent.change(time, { target: { value: "2026-10-22T09:15" } });
    await user.click(within(dialog).getByRole("button", { name: O.confirm }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/delivery-outcome`, {
        outcome: "DELIVERED",
        failureReason: undefined,
        note: undefined,
        deliveredAt: "2026-10-22T02:15:00.000Z",
      }),
    );
  });

  it("thời điểm ở tương lai → báo lỗi tiếng Việt, nút Ghi nhận bị khoá", async () => {
    const { dialog, time } = await openDelivered();
    fireEvent.change(time, { target: { value: "2999-01-01T10:00" } });
    expect(await within(dialog).findByText(DT.future)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: O.confirm })).toBeDisabled();
  });

  it("thời điểm trước lúc bàn giao → báo lỗi, nút Ghi nhận bị khoá", async () => {
    const { dialog, time } = await openDelivered();
    fireEvent.change(time, { target: { value: "2026-10-20T09:00" } });
    expect(await within(dialog).findByText(DT.beforeHandover)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: O.confirm })).toBeDisabled();
  });

  it("BE từ chối thời điểm (422) → câu tiếng Việt của mã đó trong hộp thoại", async () => {
    const user = userEvent.setup();
    renderShipment(ACTORS.orderCoordinator, handedOver(), () => {
      throw new ApiError(422, "SHIPMENT_DELIVERY_TIME_BEFORE_HANDOVER", "en");
    });
    await user.click(await screen.findByRole("button", { name: L.outcomeAction.DELIVERED }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: O.confirm }));
    expect(
      await within(dialog).findByText(ERR.SHIPMENT_DELIVERY_TIME_BEFORE_HANDOVER),
    ).toBeInTheDocument();
  });

  it("giao thất bại / hàng hoàn không có ô thời điểm giao", async () => {
    const user = userEvent.setup();
    renderShipment(ACTORS.orderCoordinator, handedOver());
    await user.click(await screen.findByRole("button", { name: L.outcomeAction.DELIVERY_FAILED }));
    expect(screen.queryByLabelText(O.deliveredAt)).not.toBeInTheDocument();
  });
});

describe("ShipmentScreen — sửa tay kết quả giao (docs 09 §4.3 bước 5)", () => {
  const delivered = () =>
    shipment({
      status: "DELIVERED",
      carrierName: "Ahamove",
      handedOverAt: "2026-10-21T03:00:00Z",
      outcomeAt: "2026-10-22T03:00:00Z",
    });
  const failed = () =>
    shipment({
      status: "DELIVERY_FAILED",
      failureReason: "REFUSED",
      handedOverAt: "2026-10-21T03:00:00Z",
      outcomeAt: "2026-10-22T03:00:00Z",
    });

  it("chỉ người có mã quyền sửa kết quả thấy nút; lô chưa có kết quả thì không", async () => {
    renderShipment(ACTORS.warehouseManagerFull, delivered());
    expect(await screen.findByRole("button", { name: C.action })).toBeInTheDocument();
  });

  it.each([
    ["quản lý kho thiếu mã quyền sửa", ACTORS.warehouseManager],
    ["điều phối (chỉ ghi nhận kết quả)", ACTORS.orderCoordinator],
    ["nhân viên kho", ACTORS.warehouseStaff],
    ["chỉ xem", ACTORS.viewOnly],
  ])("%s: không thấy nút sửa", async (_name, actor) => {
    renderShipment(actor, delivered());
    await screen.findByRole("heading", { name: `${L.title} · SO-1-S1` });
    expect(screen.queryByRole("button", { name: C.action })).not.toBeInTheDocument();
  });

  it("lô đã bàn giao (chưa có kết quả) không có nút sửa dù có quyền", async () => {
    renderShipment(ACTORS.warehouseManagerFull, shipment({ status: "HANDED_OVER" }));
    await screen.findByRole("button", { name: L.outcomeAction.DELIVERED });
    expect(screen.queryByRole("button", { name: C.action })).not.toBeInTheDocument();
  });

  it("đã giao → giao thất bại: bắt buộc lý do sửa và lý do thất bại; gửi đúng body", async () => {
    const user = userEvent.setup();
    const { post } = renderShipment(ACTORS.warehouseManagerFull, delivered());
    await user.click(await screen.findByRole("button", { name: C.action }));
    const dialog = screen.getByRole("dialog");
    const save = within(dialog).getByRole("button", { name: C.submit });
    expect(save).toBeDisabled();
    await user.click(within(dialog).getByRole("radio", { name: "Thất lạc hàng" }));
    await waitFor(() => expect(save).toBeDisabled());
    await user.type(within(dialog).getByLabelText(new RegExp(C.reason)), "Khách báo chưa nhận");
    await waitFor(() => expect(save).toBeEnabled());
    expect(within(dialog).getByText(C.invoiceNote)).toBeInTheDocument();
    await user.click(save);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/delivery-outcome-correction`, {
        outcome: "DELIVERY_FAILED",
        failureReason: "LOST",
        note: undefined,
        reason: "Khách báo chưa nhận",
        deliveredAt: undefined,
      }),
    );
  });

  it("giao thất bại → đã giao: có ô thời điểm giao; không nhập lý do sửa thì không lưu được", async () => {
    const user = userEvent.setup();
    const { post } = renderShipment(ACTORS.warehouseManagerFull, failed());
    await user.click(await screen.findByRole("button", { name: C.action }));
    const dialog = screen.getByRole("dialog");
    const save = within(dialog).getByRole("button", { name: C.submit });
    expect(save).toBeDisabled();
    expect(within(dialog).queryAllByRole("radio")).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText(O.deliveredAt), {
      target: { value: "2026-10-22T09:15" },
    });
    expect(save).toBeDisabled();
    await user.type(within(dialog).getByLabelText(new RegExp(C.reason)), "Tìm thấy ở lễ tân");
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/delivery-outcome-correction`, {
        outcome: "DELIVERED",
        failureReason: undefined,
        note: undefined,
        reason: "Tìm thấy ở lễ tân",
        deliveredAt: "2026-10-22T02:15:00.000Z",
      }),
    );
  });

  it("hộp thoại cao cuộn được, nút Lưu nằm ngoài vùng cuộn (màn thấp vẫn bấm được)", async () => {
    const user = userEvent.setup();
    renderShipment(ACTORS.warehouseManagerFull, delivered());
    await user.click(await screen.findByRole("button", { name: C.action }));
    const dialog = screen.getByRole("dialog");
    const scroll = within(dialog).getByLabelText(new RegExp(C.reason)).closest(".overflow-y-auto");
    expect(scroll).not.toBeNull();
    expect(scroll).not.toContainElement(within(dialog).getByRole("button", { name: C.submit }));
  });

  it("đơn đã hoàn tất (409 ORDER_DELIVERY_NOT_CORRECTABLE) → câu tiếng Việt trong hộp thoại", async () => {
    const user = userEvent.setup();
    renderShipment(ACTORS.warehouseManagerFull, failed(), undefined, () => {
      throw new ApiError(409, "ORDER_DELIVERY_NOT_CORRECTABLE", "en");
    });
    await user.click(await screen.findByRole("button", { name: C.action }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText(new RegExp(C.reason)), "Nhầm kết quả");
    await user.click(within(dialog).getByRole("button", { name: C.submit }));
    expect(await within(dialog).findByText(ERR.ORDER_DELIVERY_NOT_CORRECTABLE)).toBeInTheDocument();
  });
});
