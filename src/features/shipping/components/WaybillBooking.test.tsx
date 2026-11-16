import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES, SHIPPING_ERROR_MESSAGES as ERR, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { formatMoney } from "@/lib/format/money";
import { useRejectedScansStore } from "@/features/shipping/rejected-scans-store";
import { resetScanIds } from "@/features/shipping/scan-ids";

import {
  FTL_ID,
  blockedOrder,
  dispatchedLoad,
  ftlLoad,
  loadingFtl,
  plannedLoad,
} from "../__fixtures__/ftl-load";
import { loadShipment, parcel } from "../__fixtures__/load";
import {
  SHIPPING_ACTORS as ACTORS,
  mockShippingApi,
  renderShippingScreen,
} from "../__fixtures__/render";
import { LoadScreen } from "./LoadScreen";

import type { TestActor } from "../__fixtures__/render";
import type { Load } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => {
  vi.restoreAllMocks();
  useRejectedScansStore.setState({ byLoad: {} });
  resetScanIds();
  sessionStorage.clear();
});

const PATH = `/fulfillment/loads/${FTL_ID}`;
const L = UI_LABELS.shipping;
const F = L.ftl;
const W = L.waybill.card;
const WD = L.waybill.dialog;
const A = L.waybill.apiBooking;
const WARN = L.waybill.warnings;
const BLOCKED = L.waybill.blocked;

/** Xe đã đặt qua hãng API (BR-29): mã vận đơn là mã đơn hãng trả về. */
const apiBooked = (patch: Partial<Load> = {}) =>
  ftlLoad({
    carrierId: "car-ahm",
    carrierCode: "AHAMOVE",
    carrierName: "Ahamove",
    carrierConnectionType: "API_BOOKING",
    waybillNo: "AHM-7788",
    carrierBooking: {
      status: "BOOKED",
      carrierOrderId: "AHM-7788",
      trackingLink: "https://track.example.vn/AHM-7788",
    },
    ...patch,
  });

/** Hai lô trên xe để thử đổi thứ tự điểm giao. */
const twoStops = (patch: Partial<Load> = {}) =>
  plannedLoad({
    shipments: [
      loadShipment("SO-1-S1", [parcel("PKG-SO-1-1", false)]),
      loadShipment("SO-2-S1", [parcel("PKG-SO-2-1", false)]),
    ],
    shipmentCount: 2,
    expectedPackageCount: 2,
    ...patch,
  });

interface Handlers {
  booking?: (body: unknown) => Load;
  waybill?: (body: unknown) => Load;
  loadingStart?: () => Load;
  history?: () => unknown;
}

/** GET chuyến luôn trả bản mới nhất mà một thao tác ghi vừa trả về (như BE). */
function renderLoad(actor: TestActor, initial: Load, handlers: Handlers = {}) {
  let current = initial;
  const write =
    (handler: ((body: unknown) => Load) | undefined) => (_p: unknown, body?: unknown) => {
      current = handler ? handler(body) : current;
      return current;
    };
  const spies = mockShippingApi(actor, {
    get: {
      [PATH]: () => current,
      [`${PATH}/waybill-history`]: () => (handlers.history ?? (() => []))(),
    },
    post: {
      [`${PATH}/booking`]: write(handlers.booking),
      [`${PATH}/loading-start`]: write(handlers.loadingStart),
    },
    put: { [`${PATH}/waybill`]: write(handlers.waybill) },
  });
  renderShippingScreen(<LoadScreen id={FTL_ID} />);
  return spies;
}

const ready = () => screen.findByRole("heading", { name: `${L.load.title} · ${FTL_ID}` });
const waybillSection = () =>
  within(screen.getByRole("heading", { name: W.title }).closest("section") as HTMLElement);
/** Thân yêu cầu đúng như đi qua JSON: trường `undefined` không có trong body gửi BE. */
const sent = (body: unknown): unknown => JSON.parse(JSON.stringify(body));

async function chooseCarrier(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(within(screen.getByRole("dialog")).getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name }));
}

describe("Đặt xe — hãng thường (MANUAL / WEBHOOK_LOAD)", () => {
  it("nhập mã vận đơn ngay lúc đặt: POST /booking mang cả mã; không có giờ hẹn / thứ tự điểm giao", async () => {
    const user = userEvent.setup();
    const { post } = renderLoad(ACTORS.warehouseStaff, plannedLoad(), {
      booking: () => ftlLoad({ waybillNo: "GHN-777" }),
    });
    await user.click(await screen.findByRole("button", { name: F.booking.book }));
    const dialog = await screen.findByRole("dialog");
    await chooseCarrier(user, /GHN/);
    expect(within(dialog).queryByLabelText(A.pickupAt)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(A.stops)).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(F.bookDialog.vehiclePlate), "51C-628.14");
    await user.type(within(dialog).getByLabelText(F.bookDialog.waybillNo), "GHN-777");
    await user.click(within(dialog).getByRole("button", { name: F.bookDialog.submit }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body] = post.mock.calls[0] ?? [];
    expect(url).toBe(`${PATH}/booking`);
    expect(sent(body)).toEqual({
      carrierId: "car-ghn",
      vehiclePlate: "51C-628.14",
      waybillNo: "GHN-777",
    });
    // Chuyến sang VEHICLE_BOOKED có mã: thẻ mã vận đơn hiện mã
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await waybillSection().findByText("GHN-777")).toBeInTheDocument();
  });

  it("webhook theo chuyến cũng là hãng thường: có ô biển số / tài xế / mã vận đơn, không có giờ hẹn", async () => {
    const user = userEvent.setup();
    renderLoad(ACTORS.warehouseStaff, plannedLoad());
    await user.click(await screen.findByRole("button", { name: F.booking.book }));
    const dialog = await screen.findByRole("dialog");
    await chooseCarrier(user, /VTP/);
    expect(within(dialog).getByLabelText(F.bookDialog.waybillNo)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(A.pickupAt)).not.toBeInTheDocument();
  });

  it("mã vận đơn có khoảng trắng bị chặn trước khi gửi", async () => {
    const user = userEvent.setup();
    const { post } = renderLoad(ACTORS.warehouseStaff, plannedLoad());
    await user.click(await screen.findByRole("button", { name: F.booking.book }));
    const dialog = await screen.findByRole("dialog");
    await chooseCarrier(user, /GHN/);
    await user.type(within(dialog).getByLabelText(F.bookDialog.waybillNo), "GHN 777");
    expect(within(dialog).getByRole("button", { name: F.bookDialog.submit })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });
});

describe("Đặt xe — hãng đặt xe qua API (BR-29)", () => {
  it("chọn hãng API: ô biển số / tài xế / mã vận đơn biến mất, hiện giờ hẹn + thứ tự điểm giao theo biên bản", async () => {
    const user = userEvent.setup();
    renderLoad(ACTORS.warehouseStaff, twoStops());
    await user.click(await screen.findByRole("button", { name: F.booking.book }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(F.bookDialog.vehiclePlate)).toBeInTheDocument();
    await chooseCarrier(user, /AHAMOVE/);
    for (const label of [
      F.bookDialog.vehiclePlate,
      F.bookDialog.driverName,
      F.bookDialog.driverPhone,
      F.bookDialog.waybillNo,
    ]) {
      expect(within(dialog).queryByLabelText(label)).not.toBeInTheDocument();
    }
    expect(within(dialog).getByLabelText(A.pickupAt)).toHaveAttribute("type", "datetime-local");
    const stops = within(dialog).getAllByRole("listitem");
    expect(stops).toHaveLength(2);
    expect(within(stops[0] as HTMLElement).getByText("SO-1-S1")).toBeInTheDocument();
    expect(within(stops[1] as HTMLElement).getByText("SO-2-S1")).toBeInTheDocument();
    // Điểm đầu không lên được, điểm cuối không xuống được
    expect(within(dialog).getByRole("button", { name: A.upAria("SO-1-S1") })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: A.downAria("SO-2-S1") })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: A.submit })).toBeEnabled();
  });

  it("đổi thứ tự điểm giao + giờ hẹn 09:30 (UTC+7) → POST /booking {carrierId, pickupAt UTC, stopShipmentIds}, không biển số / tài xế / mã", async () => {
    const user = userEvent.setup();
    const { post } = renderLoad(ACTORS.warehouseStaff, twoStops(), {
      booking: () => apiBooked(),
    });
    await user.click(await screen.findByRole("button", { name: F.booking.book }));
    const dialog = await screen.findByRole("dialog");
    await chooseCarrier(user, /AHAMOVE/);
    // datetime-local: userEvent không gõ được vào ô này → đặt giá trị trực tiếp
    fireEvent.change(within(dialog).getByLabelText(A.pickupAt), {
      target: { value: "2026-11-12T09:30" },
    });
    await user.click(within(dialog).getByRole("button", { name: A.downAria("SO-1-S1") }));
    const stops = within(dialog).getAllByRole("listitem");
    expect(within(stops[0] as HTMLElement).getByText("SO-2-S1")).toBeInTheDocument();
    expect(within(stops[1] as HTMLElement).getByText("SO-1-S1")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: A.submit }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body] = post.mock.calls[0] ?? [];
    expect(url).toBe(`${PATH}/booking`);
    expect(sent(body)).toEqual({
      carrierId: "car-ahm",
      pickupAt: "2026-11-12T02:30:00.000Z",
      stopShipmentIds: ["shp-SO-2-S1", "shp-SO-1-S1"],
    });
  });

  it("bỏ trống giờ hẹn: không gửi pickupAt (hãng lấy hàng sớm nhất); thứ tự mặc định theo biên bản", async () => {
    const user = userEvent.setup();
    const { post } = renderLoad(ACTORS.warehouseStaff, twoStops(), { booking: () => apiBooked() });
    await user.click(await screen.findByRole("button", { name: F.booking.book }));
    await chooseCarrier(user, /AHAMOVE/);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: A.submit }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(sent(post.mock.calls[0]?.[1])).toEqual({
      carrierId: "car-ahm",
      stopShipmentIds: ["shp-SO-1-S1", "shp-SO-2-S1"],
    });
  });

  it("đặt lại xe đã có biển số / tài xế sang hãng API: thông tin cũ không bị gửi theo", async () => {
    const user = userEvent.setup();
    const { post } = renderLoad(
      ACTORS.warehouseStaff,
      ftlLoad({ driverPhone: "0911222333", waybillNo: "GHN-1" }),
      { booking: () => apiBooked() },
    );
    await user.click(await screen.findByRole("button", { name: F.booking.rebook }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(F.bookDialog.vehiclePlate)).toHaveValue("51C-628.14");
    await chooseCarrier(user, /AHAMOVE/);
    await user.click(within(dialog).getByRole("button", { name: A.submit }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const body = sent(post.mock.calls[0]?.[1]);
    expect(body).toMatchObject({ carrierId: "car-ahm" });
    for (const key of ["vehiclePlate", "driverName", "driverPhone", "waybillNo"]) {
      expect(body).not.toHaveProperty(key);
    }
  });

  it("hãng từ chối đơn (409 CARRIER_BOOKING_FAILED): câu tiếng Việt kèm lý do hãng nêu, hộp thoại giữ nguyên", async () => {
    const user = userEvent.setup();
    const { post } = renderLoad(ACTORS.warehouseStaff, twoStops());
    post.mockRejectedValueOnce(
      new ApiError(409, "CARRIER_BOOKING_FAILED", "en", { carrier: "Hết xe tải" }),
    );
    await user.click(await screen.findByRole("button", { name: F.booking.book }));
    const dialog = await screen.findByRole("dialog");
    await chooseCarrier(user, /AHAMOVE/);
    await user.click(within(dialog).getByRole("button", { name: A.submit }));
    expect(
      await within(dialog).findByText(`${ERR.CARRIER_BOOKING_FAILED} Lý do hãng nêu: Hết xe tải`),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("đã đặt qua API: hiện đơn ở hãng (trạng thái, mã đơn, liên kết theo dõi); không sửa thông tin đặt xe tay, vẫn huỷ đặt xe được", async () => {
    renderLoad(ACTORS.warehouseStaff, apiBooked());
    await ready();
    const notice = screen.getByText(A.notice.title).parentElement as HTMLElement;
    expect(within(notice).getByText(A.notice.status.BOOKED)).toBeInTheDocument();
    expect(within(notice).getByText("AHM-7788")).toBeInTheDocument();
    expect(within(notice).getByRole("link", { name: A.notice.tracking })).toHaveAttribute(
      "href",
      "https://track.example.vn/AHM-7788",
    );
    expect(screen.queryByRole("button", { name: F.booking.rebook })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: F.booking.cancel })).toBeInTheDocument();
  });

  it("liên kết theo dõi không phải http(s) thì không thành liên kết; đơn bị hãng từ chối hiện lỗi gần nhất", async () => {
    renderLoad(
      ACTORS.warehouseStaff,
      apiBooked({
        waybillNo: undefined,
        carrierBooking: {
          status: "FAILED",
          trackingLink: "javascript:alert(1)",
          lastError: "Ngoài vùng phục vụ",
        },
      }),
    );
    await ready();
    const notice = screen.getByText(A.notice.title).parentElement as HTMLElement;
    expect(within(notice).getByText(A.notice.status.FAILED)).toBeInTheDocument();
    expect(within(notice).queryByRole("link")).not.toBeInTheDocument();
    expect(
      within(notice).getByText(`${A.notice.lastError}: Ngoài vùng phục vụ`),
    ).toBeInTheDocument();
  });

  it("hãng thường không có thẻ 'Đơn ở hãng'", async () => {
    renderLoad(ACTORS.warehouseStaff, ftlLoad());
    await ready();
    expect(screen.queryByText(A.notice.title)).not.toBeInTheDocument();
  });
});

describe("Thẻ mã vận đơn", () => {
  it("xe chưa đặt: chưa có thẻ mã vận đơn (đặt xe với hãng trước)", async () => {
    renderLoad(ACTORS.warehouseManager, plannedLoad());
    await ready();
    expect(screen.queryByRole("heading", { name: W.title })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: W.record })).not.toBeInTheDocument();
  });

  it("chưa có mã: cảnh báo bắt buộc trước khi ký + nút 'Nhập mã vận đơn' + liên kết nhập từ file", async () => {
    renderLoad(ACTORS.warehouseStaff, ftlLoad());
    await ready();
    const card = waybillSection();
    expect(card.getByText(W.missing)).toBeInTheDocument();
    expect(card.getByText(W.missingHint)).toBeInTheDocument();
    expect(card.getByRole("button", { name: W.record })).toBeInTheDocument();
    expect(card.getByRole("link", { name: W.importLink })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.loads.waybillImport,
    );
  });

  it("nhập mã: PUT /waybill {waybillNo, biển số, tài xế có sẵn}; thẻ đổi sang mã mới và nút thành 'Sửa mã vận đơn'", async () => {
    const user = userEvent.setup();
    const { put } = renderLoad(ACTORS.warehouseStaff, ftlLoad(), {
      waybill: () => ftlLoad({ waybillNo: "GHN-9" }),
    });
    await user.click(await screen.findByRole("button", { name: W.record }));
    const dialog = await screen.findByRole("dialog", { name: new RegExp(WD.title) });
    const submit = within(dialog).getByRole("button", { name: WD.submit });
    expect(submit).toBeDisabled();
    // Biển số / tài xế của lần đặt xe điền sẵn
    expect(within(dialog).getByLabelText(L.field.vehiclePlate)).toHaveValue("51C-628.14");
    expect(within(dialog).queryByLabelText(new RegExp(WD.reason))).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(new RegExp(WD.waybillNo)), "GHN-9");
    await user.click(submit);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    const [url, body] = put.mock.calls[0] ?? [];
    expect(url).toBe(`${PATH}/waybill`);
    expect(sent(body)).toEqual({
      waybillNo: "GHN-9",
      vehiclePlate: "51C-628.14",
      driverName: "Lê Văn Xế",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await waybillSection().findByText("GHN-9")).toBeInTheDocument();
    expect(waybillSection().getByRole("button", { name: W.edit })).toBeInTheDocument();
    expect(waybillSection().queryByText(W.missing)).not.toBeInTheDocument();
  });

  it("đã có mã, đang xếp hàng: 'Sửa mã vận đơn' mở hộp thoại có sẵn mã hiện tại; sửa trước khi rời kho không cần lý do", async () => {
    const user = userEvent.setup();
    const { put } = renderLoad(ACTORS.warehouseStaff, loadingFtl({ waybillNo: "GHN-1" }), {
      waybill: () => loadingFtl({ waybillNo: "GHN-2" }),
    });
    await ready();
    expect(waybillSection().getByText("GHN-1")).toBeInTheDocument();
    await user.click(waybillSection().getByRole("button", { name: W.edit }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText(new RegExp(WD.waybillNo));
    expect(input).toHaveValue("GHN-1");
    await user.clear(input);
    await user.type(input, "GHN-2");
    await user.click(within(dialog).getByRole("button", { name: WD.submit }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        `${PATH}/waybill`,
        expect.objectContaining({ waybillNo: "GHN-2" }),
      ),
    );
  });

  it("mã trùng ở hãng (409 WAYBILL_DUPLICATE): lỗi tiếng Việt ngay trong hộp thoại, hộp thoại giữ nguyên, sửa ô thì lỗi mất", async () => {
    const user = userEvent.setup();
    const { put } = renderLoad(ACTORS.warehouseStaff, ftlLoad());
    put.mockRejectedValueOnce(new ApiError(409, "WAYBILL_DUPLICATE", "en"));
    await user.click(await screen.findByRole("button", { name: W.record }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText(new RegExp(WD.waybillNo));
    await user.type(input, "GHN-DUP");
    await user.click(within(dialog).getByRole("button", { name: WD.submit }));
    expect(await within(dialog).findByText(ERR.WAYBILL_DUPLICATE)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.type(input, "2");
    await waitFor(() =>
      expect(within(dialog).queryByText(ERR.WAYBILL_DUPLICATE)).not.toBeInTheDocument(),
    );
  });

  it("sau khi rời kho, quản lý kho sửa mã: bắt buộc lý do, không có ô biển số / tài xế, PUT chỉ gồm mã + lý do", async () => {
    const user = userEvent.setup();
    const { put } = renderLoad(ACTORS.warehouseManager, dispatchedLoad(), {
      waybill: () => dispatchedLoad({ waybillNo: "GHN-FIX" }),
    });
    await ready();
    await user.click(waybillSection().getByRole("button", { name: W.correct }));
    const dialog = await screen.findByRole("dialog", { name: new RegExp(WD.correctionTitle) });
    expect(within(dialog).queryByLabelText(L.field.vehiclePlate)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(L.field.driverName)).not.toBeInTheDocument();
    const submit = within(dialog).getByRole("button", { name: WD.correctionSubmit });
    const input = within(dialog).getByLabelText(new RegExp(WD.waybillNo));
    expect(input).toHaveValue("GHN-250001");
    await user.clear(input);
    await user.type(input, "GHN-FIX");
    // Chưa có lý do → chưa gửi được
    expect(submit).toBeDisabled();
    await user.type(within(dialog).getByLabelText(new RegExp(WD.reason)), "Hãng cấp lại mã");
    await user.click(submit);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(sent(put.mock.calls[0]?.[1])).toEqual({
      waybillNo: "GHN-FIX",
      reason: "Hãng cấp lại mã",
    });
    expect(await waybillSection().findByText("GHN-FIX")).toBeInTheDocument();
  });

  it("sau khi rời kho: nhân viên kho không có nút sửa mã (cần fulfillment-waybill-corrections:UPDATE) và không có liên kết nhập file; mã vẫn hiện", async () => {
    renderLoad(ACTORS.warehouseStaff, dispatchedLoad());
    await ready();
    const card = waybillSection();
    expect(card.getByText("GHN-250001")).toBeInTheDocument();
    expect(card.queryByRole("button", { name: W.correct })).not.toBeInTheDocument();
    expect(card.queryByRole("button", { name: W.edit })).not.toBeInTheDocument();
    expect(card.queryByRole("link", { name: W.importLink })).not.toBeInTheDocument();
  });

  it("hãng API: mã do hãng cấp, không có nút nhập / sửa / nhập file; giải thích vì sao", async () => {
    renderLoad(ACTORS.warehouseManager, apiBooked());
    await ready();
    const card = waybillSection();
    expect(card.getByText("AHM-7788")).toBeInTheDocument();
    expect(card.getByText(W.apiManaged)).toBeInTheDocument();
    expect(card.queryByRole("button", { name: W.record })).not.toBeInTheDocument();
    expect(card.queryByRole("button", { name: W.edit })).not.toBeInTheDocument();
    expect(card.queryByRole("link", { name: W.importLink })).not.toBeInTheDocument();
  });

  it("hãng API chưa có mã: cảnh báo thiếu kèm giải thích mã do hãng cấp, không mời nhập tay", async () => {
    renderLoad(ACTORS.warehouseManager, apiBooked({ waybillNo: undefined }));
    await ready();
    const card = waybillSection();
    expect(card.getByText(W.missing)).toBeInTheDocument();
    expect(card.getByText(W.apiManaged)).toBeInTheDocument();
    expect(card.queryByText(W.missingHint)).not.toBeInTheDocument();
    expect(card.queryByRole("button", { name: W.record })).not.toBeInTheDocument();
  });

  it.each([
    ["nhân viên kho", ACTORS.warehouseStaff, { record: true, importLink: true }],
    ["quản lý kho", ACTORS.warehouseManager, { record: true, importLink: true }],
    ["điều phối đơn hàng", ACTORS.orderCoordinator, { record: false, importLink: false }],
    ["chỉ xem", ACTORS.viewOnly, { record: false, importLink: false }],
  ])(
    "%s: nút nhập mã / liên kết nhập file theo mã quyền; lịch sử luôn xem được",
    async (_name, actor, want) => {
      renderLoad(actor, ftlLoad());
      await ready();
      const card = waybillSection();
      expect(card.queryByRole("button", { name: W.record }) !== null).toBe(want.record);
      expect(card.queryByRole("link", { name: W.importLink }) !== null).toBe(want.importLink);
      expect(card.getByRole("button", { name: W.history })).toBeInTheDocument();
    },
  );

  it.each([
    ["quản lý kho", ACTORS.warehouseManager, true],
    ["nhân viên kho", ACTORS.warehouseStaff, false],
    ["điều phối đơn hàng", ACTORS.orderCoordinator, false],
  ])("xe đã rời kho — %s: nút sửa mã sau khi rời kho = %s", async (_name, actor, allowed) => {
    renderLoad(actor, dispatchedLoad());
    await ready();
    expect(waybillSection().queryByRole("button", { name: W.correct }) !== null).toBe(allowed);
  });
});

describe("Lịch sử mã vận đơn", () => {
  const changes = [
    {
      newWaybillNo: "GHN-1",
      source: "MANUAL",
      changedByName: "Nhân viên kho",
      changedAt: "2026-10-21T01:00:00Z",
    },
    {
      oldWaybillNo: "GHN-1",
      newWaybillNo: "GHN-2",
      source: "MANUAL",
      changedByName: "Quản lý kho",
      changedAt: "2026-10-21T05:00:00Z",
      reason: "Hãng cấp lại mã",
    },
    {
      oldWaybillNo: "GHN-2",
      source: "WEBHOOK",
      changedAt: "2026-10-21T06:00:00Z",
    },
  ];

  it("chỉ tải lịch sử khi mở; hiện từng lần đổi (mã cũ → mới, nguồn, người, lý do), bấm lần nữa thì ẩn", async () => {
    const user = userEvent.setup();
    const { get } = renderLoad(ACTORS.warehouseStaff, loadingFtl({ waybillNo: "GHN-2" }), {
      history: () => changes,
    });
    await ready();
    const historyCalls = () => get.mock.calls.filter(([url]) => url === `${PATH}/waybill-history`);
    expect(historyCalls()).toHaveLength(0);
    const toggle = waybillSection().getByRole("button", { name: W.history });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    const table = await screen.findByRole("table", { name: W.history });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(historyCalls()).toHaveLength(1);
    const rows = within(table).getAllByRole("row");
    // Tiêu đề + 3 lần đổi
    expect(rows).toHaveLength(4);
    const second = within(rows[2] as HTMLElement);
    expect(second.getByText("GHN-1")).toBeInTheDocument();
    expect(second.getByText("GHN-2")).toBeInTheDocument();
    expect(second.getByText(W.source.MANUAL)).toBeInTheDocument();
    expect(second.getByText("Quản lý kho")).toBeInTheDocument();
    expect(second.getByText("Hãng cấp lại mã")).toBeInTheDocument();
    // Hãng báo mã qua webhook: không có người đổi, mã bị xoá cùng đặt xe
    const third = within(rows[3] as HTMLElement);
    expect(third.getByText(W.source.WEBHOOK)).toBeInTheDocument();
    expect(third.getByText(W.historyCarrier)).toBeInTheDocument();
    expect(third.getByText(W.historyRemoved)).toBeInTheDocument();
    await user.click(toggle);
    expect(screen.queryByRole("table", { name: W.history })).not.toBeInTheDocument();
  });

  it("chưa có thay đổi nào → câu báo trống", async () => {
    const user = userEvent.setup();
    renderLoad(ACTORS.viewOnly, ftlLoad(), { history: () => [] });
    await ready();
    await user.click(waybillSection().getByRole("button", { name: W.history }));
    expect(await screen.findByText(W.historyEmpty)).toBeInTheDocument();
  });

  it("tải lịch sử lỗi → báo không tải được, không vỡ màn chuyến", async () => {
    const user = userEvent.setup();
    renderLoad(ACTORS.viewOnly, ftlLoad(), {
      history: () => {
        throw new ApiError(500, "INTERNAL_ERROR", "boom");
      },
    });
    await ready();
    await user.click(waybillSection().getByRole("button", { name: W.history }));
    expect(await screen.findByText(W.historyLoadFailed)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: `${L.load.title} · ${FTL_ID}` }),
    ).toBeInTheDocument();
  });
});

describe("Cảnh báo bàn giao sau 'Bắt đầu xếp hàng'", () => {
  const unpaid = blockedOrder();
  const early = blockedOrder({
    orderId: "ord-SO-3",
    orderNumber: "SO-3",
    reasonCode: "DELIVERY_BATCH_WINDOW_NOT_OPEN",
    amountDue: undefined,
    windowStart: "2026-11-20",
    deliveryBatchSeq: 2,
  });

  async function startLoading(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: F.booking.start }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: F.startDialog.confirm }),
    );
  }

  it("câu trả lời mang handoverWarnings → hiện từng đơn kèm lý do tiếng Việt; vẫn xếp hàng được; Ẩn thì mất", async () => {
    const user = userEvent.setup();
    renderLoad(ACTORS.warehouseStaff, ftlLoad(), {
      loadingStart: () => loadingFtl({ handoverWarnings: [unpaid, early] }),
    });
    await startLoading(user);
    const notice = (await screen.findByText(WARN.title)).parentElement as HTMLElement;
    expect(within(notice).getByText(WARN.description)).toBeInTheDocument();
    const items = within(notice).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByRole("link", { name: "SO-2" })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.orders.detail("ord-SO-2"),
    );
    // Intl dùng khoảng trắng không ngắt giữa số và ₫; DOM text được chuẩn hoá thành dấu cách thường
    const due = formatMoney(15_000_000, "VND").replace(/\s/g, " ");
    expect(items[0]).toHaveTextContent(BLOCKED.unpaidBatch(due, 1));
    expect(items[1]).toHaveTextContent("SO-3");
    expect(items[1]).toHaveTextContent(/Đợt giao 2 chưa tới ngày bắt đầu cửa sổ giao/);
    // Cảnh báo không chặn xếp hàng: ô quét có
    expect(await screen.findByLabelText(L.scan.label)).toBeInTheDocument();
    await user.click(within(notice).getByRole("button", { name: WARN.dismiss }));
    expect(screen.queryByText(WARN.title)).not.toBeInTheDocument();
  });

  it("đơn đang tạm giữ (ORDER_INVALID_TRANSITION) → câu 'đang tạm giữ'", async () => {
    const user = userEvent.setup();
    renderLoad(ACTORS.warehouseStaff, ftlLoad(), {
      loadingStart: () =>
        loadingFtl({
          handoverWarnings: [
            blockedOrder({ reasonCode: "ORDER_INVALID_TRANSITION", amountDue: undefined }),
          ],
        }),
    });
    await startLoading(user);
    const notice = (await screen.findByText(WARN.title)).parentElement as HTMLElement;
    expect(within(notice).getByText(new RegExp(BLOCKED.onHold))).toBeInTheDocument();
  });

  it("không có cảnh báo → không hiện khối cảnh báo", async () => {
    const user = userEvent.setup();
    renderLoad(ACTORS.warehouseStaff, ftlLoad(), { loadingStart: () => loadingFtl() });
    await startLoading(user);
    expect(await screen.findByLabelText(L.scan.label)).toBeInTheDocument();
    expect(screen.queryByText(WARN.title)).not.toBeInTheDocument();
  });
});

describe("Gate nút đặt xe theo mã quyền", () => {
  it.each([
    ["nhân viên kho", ACTORS.warehouseStaff, true],
    ["quản lý kho", ACTORS.warehouseManager, true],
    ["điều phối đơn hàng", ACTORS.orderCoordinator, false],
    ["chỉ xem", ACTORS.viewOnly, false],
  ])("xe chưa đặt — %s: nút Đặt xe = %s", async (_name, actor, allowed) => {
    renderLoad(actor, plannedLoad());
    await ready();
    expect(screen.queryByRole("button", { name: F.booking.book }) !== null).toBe(allowed);
  });
});
