import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SHIPPING_ERROR_MESSAGES as ERR, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useRejectedScansStore } from "@/features/shipping/rejected-scans-store";
import { resetScanIds } from "@/features/shipping/scan-ids";

import {
  FTL_ID,
  OTHER_VEHICLE,
  ftlLoad,
  ftlManifest,
  ftlParcel,
  kit,
  loadingFtl,
  pendingUnload,
  plannedLoad,
} from "../__fixtures__/ftl-load";
import { loadShipment } from "../__fixtures__/load";
import {
  SHIPPING_ACTORS as ACTORS,
  mockShippingApi,
  renderShippingScreen,
} from "../__fixtures__/render";
import { LoadScreen } from "./LoadScreen";
import { ManifestScreen } from "./ManifestScreen";

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

type Handler = (body: Record<string, unknown>) => unknown;
interface Handlers {
  booking?: Handler;
  bookingCancellation?: Handler;
  loadingStart?: Handler;
  unloads?: Handler;
  scans?: Handler;
}

function renderFtl(actor: TestActor, load: Load, handlers: Handlers = {}) {
  const run = (handler: Handler | undefined) => (_p: unknown, body?: unknown) =>
    (handler ?? (() => load))((body ?? {}) as Record<string, unknown>);
  const spies = mockShippingApi(actor, {
    get: { [PATH]: () => load },
    post: {
      [`${PATH}/booking`]: run(handlers.booking),
      [`${PATH}/booking-cancellation`]: run(handlers.bookingCancellation),
      [`${PATH}/loading-start`]: run(handlers.loadingStart),
      [`${PATH}/unloads`]: run(handlers.unloads),
      [`${PATH}/scans`]: run(handlers.scans),
    },
  });
  renderShippingScreen(<LoadScreen id={FTL_ID} />);
  return spies;
}

const ready = () => screen.findByRole("heading", { name: `${L.load.title} · ${FTL_ID}` });

describe("Chuyến nguyên xe — xe của kế hoạch và đặt xe", () => {
  it("xe chưa đặt: hiện mã kế hoạch, số xe, loại xe, nút Đặt xe; chưa có ô quét, không thêm lô / huỷ chuyến", async () => {
    renderFtl(ACTORS.warehouseManager, plannedLoad());
    await ready();
    const card = screen.getByRole("heading", { name: F.planCard }).closest("section");
    expect(within(card as HTMLElement).getByText("LP-2026-0001")).toBeInTheDocument();
    expect(within(card as HTMLElement).getByText("TRUCK-1T25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: F.booking.book })).toBeInTheDocument();
    expect(screen.queryByLabelText(L.scan.label)).not.toBeInTheDocument();
    // Lô của kế hoạch do kế hoạch quản lý (BE LOAD_MANAGED_BY_PLAN): không thêm lô, không huỷ chuyến
    expect(screen.queryByRole("button", { name: L.load.addShipments })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.load.actions.cancel })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: F.booking.start })).not.toBeInTheDocument();
  });

  it("xe đã đặt chuyến trước bị huỷ: hiện lý do lần đặt xe trước", async () => {
    renderFtl(
      ACTORS.warehouseStaff,
      plannedLoad({
        bookingCancelReason: "Hãng báo hết xe",
        bookingCancelledAt: "2026-10-21T02:00:00Z",
      }),
    );
    await ready();
    expect(screen.getByText(/Hãng báo hết xe/)).toBeInTheDocument();
  });

  it("đặt xe: chọn hãng + biển số + tài xế → POST /booking đúng body", async () => {
    const user = userEvent.setup();
    const booked = ftlLoad();
    const { post } = renderFtl(ACTORS.warehouseStaff, plannedLoad(), { booking: () => booked });
    await user.click(await screen.findByRole("button", { name: F.booking.book }));
    const dialog = await screen.findByRole("dialog");
    // Chưa chọn hãng → chưa gửi được
    expect(within(dialog).getByRole("button", { name: F.bookDialog.submit })).toBeDisabled();
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /GHN/ }));
    await user.type(within(dialog).getByLabelText(F.bookDialog.vehiclePlate), "51C-628.14");
    await user.type(within(dialog).getByLabelText(F.bookDialog.driverName), "Lê Văn Xế");
    await user.click(within(dialog).getByRole("button", { name: F.bookDialog.submit }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/booking`, {
        carrierId: "car-ghn",
        vehiclePlate: "51C-628.14",
        driverName: "Lê Văn Xế",
        driverPhone: undefined,
      }),
    );
    // Chuyến sang VEHICLE_BOOKED: hộp thoại đóng, hiện nút bắt đầu xếp hàng
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByRole("button", { name: F.booking.start })).toBeInTheDocument();
  });

  it("hãng khác hãng đã gán cho lô (409 SHIPMENT_OTHER_CARRIER) → lỗi tiếng Việt trong hộp thoại, hộp thoại giữ nguyên", async () => {
    const user = userEvent.setup();
    const { post } = renderFtl(ACTORS.warehouseStaff, plannedLoad());
    post.mockRejectedValueOnce(
      new ApiError(409, "SHIPMENT_OTHER_CARRIER", "en", { shipmentCode: "SO-1-S1" }),
    );
    await user.click(await screen.findByRole("button", { name: F.booking.book }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /VTP/ }));
    await user.click(within(dialog).getByRole("button", { name: F.bookDialog.submit }));
    expect(
      await within(dialog).findByText(`Lô SO-1-S1: ${ERR.SHIPMENT_OTHER_CARRIER}`),
    ).toBeInTheDocument();
  });

  it("xe đã đặt: hiện hãng, biển số, tài xế; sửa thông tin đặt xe mở hộp thoại có sẵn giá trị", async () => {
    const user = userEvent.setup();
    renderFtl(ACTORS.warehouseStaff, ftlLoad());
    await ready();
    expect(screen.getAllByText("GHN Giao Hàng Nhanh").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: F.booking.rebook }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(F.bookDialog.vehiclePlate)).toHaveValue("51C-628.14");
  });

  it("huỷ đặt xe cần lý do → POST /booking-cancellation {reason}", async () => {
    const user = userEvent.setup();
    const { post } = renderFtl(ACTORS.warehouseStaff, ftlLoad(), {
      bookingCancellation: () => plannedLoad({ bookingCancelReason: "Hãng huỷ" }),
    });
    await user.click(await screen.findByRole("button", { name: F.booking.cancel }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: F.cancelBookingDialog.confirm });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "Hãng huỷ");
    await user.click(confirm);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/booking-cancellation`, { reason: "Hãng huỷ" }),
    );
    expect(await screen.findByRole("button", { name: F.booking.book })).toBeInTheDocument();
  });

  it("bắt đầu xếp hàng: xác nhận (BR-14) rồi POST /loading-start; chuyến sang LOADING có ô quét", async () => {
    const user = userEvent.setup();
    const { post } = renderFtl(ACTORS.warehouseStaff, ftlLoad(), {
      loadingStart: () => loadingFtl({ version: 5 }),
    });
    await user.click(await screen.findByRole("button", { name: F.booking.start }));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(new RegExp(F.startDialog.description.slice(0, 20))),
    ).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: F.startDialog.confirm }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(`${PATH}/loading-start`));
    expect(await screen.findByLabelText(L.scan.label)).toBeInTheDocument();
    // Đã xếp hàng: không đổi / huỷ đặt xe được nữa
    expect(screen.queryByRole("button", { name: F.booking.cancel })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: F.booking.start })).not.toBeInTheDocument();
  });

  it("gate theo mã quyền: chỉ xem (không có fulfillment-dispatch:UPDATE) không có nút đặt xe / huỷ / bắt đầu", async () => {
    renderFtl(ACTORS.orderCoordinator, ftlLoad());
    await ready();
    for (const name of [F.booking.rebook, F.booking.cancel, F.booking.start, F.booking.book]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.getAllByText("GHN Giao Hàng Nhanh").length).toBeGreaterThan(0);
  });

  it("xe huỷ sau khi đã đặt: nhắc huỷ xe đã đặt với nhà xe, kèm hãng / biển số và lý do tự huỷ", async () => {
    renderFtl(
      ACTORS.warehouseStaff,
      ftlLoad({
        status: "CANCELLED",
        carrierBookingToCancel: true,
        cancelledAt: "2026-10-21T04:00:00Z",
        cancelReason: "auto-cancelled: nothing to carry - order SO-9 cancelled",
        shipments: [],
        shipmentCount: 0,
        expectedPackageCount: 0,
        loadedPackageCount: 0,
      }),
    );
    expect(await screen.findByText(F.bookingToCancel.title)).toBeInTheDocument();
    const notice = screen.getByText(F.bookingToCancel.title).parentElement as HTMLElement;
    expect(within(notice).getByText(/51C-628\.14/)).toBeInTheDocument();
    expect(
      within(notice).getByText(new RegExp(F.bookingToCancel.autoCancelled)),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: F.booking.rebook })).not.toBeInTheDocument();
  });

  it("xe huỷ mà không còn đặt xe ngoài hệ thống: không hiện nhắc huỷ", async () => {
    renderFtl(
      ACTORS.warehouseStaff,
      plannedLoad({ status: "CANCELLED", cancelledAt: "2026-10-21T04:00:00Z", cancelReason: "x" }),
    );
    await ready();
    expect(screen.queryByText(F.bookingToCancel.title)).not.toBeInTheDocument();
  });
});

describe("Chuyến nguyên xe — quét kiện của riêng xe", () => {
  it("kiện của xe khác: lỗi nêu đúng xe ('xe số 2 (LD-F002)'), ghi vào danh sách quét không thành công", async () => {
    const user = userEvent.setup();
    const { post } = renderFtl(ACTORS.warehouseStaff, loadingFtl());
    post.mockRejectedValueOnce(
      new ApiError(409, "PACKAGE_NOT_IN_LOAD", "en", {
        vehicleSeq: OTHER_VEHICLE.seq,
        loadCode: OTHER_VEHICLE.loadCode,
      }),
    );
    const input = await screen.findByLabelText(L.scan.label);
    await user.type(input, "pkg-so-3-1{Enter}");
    const expected = `Kiện này thuộc xe số ${OTHER_VEHICLE.seq} (${OTHER_VEHICLE.loadCode}) — không xếp lên xe này.`;
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(`PKG-SO-3-1 — ${expected}`),
    );
    expect(
      screen.getByRole("heading", { name: `${L.scan.rejectedTitle} (1)` }),
    ).toBeInTheDocument();
    expect(screen.getByText(`— ${expected}`)).toBeInTheDocument();
  });

  it("thiếu thông tin xe trong lỗi → câu chung của PACKAGE_NOT_IN_LOAD", async () => {
    const user = userEvent.setup();
    const { post } = renderFtl(ACTORS.warehouseStaff, loadingFtl());
    post.mockRejectedValueOnce(new ApiError(409, "PACKAGE_NOT_IN_LOAD", "en"));
    await user.type(await screen.findByLabelText(L.scan.label), "PKG-X-1{Enter}");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(ERR.PACKAGE_NOT_IN_LOAD),
    );
  });

  it("nhãn đã cũ (409 LABEL_OUTDATED) khi quét → báo in lại nhãn", async () => {
    const user = userEvent.setup();
    const { post } = renderFtl(ACTORS.warehouseStaff, loadingFtl());
    post.mockRejectedValueOnce(new ApiError(409, "LABEL_OUTDATED", "en"));
    await user.type(await screen.findByLabelText(L.scan.label), "PKG-SO-1-2{Enter}");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/in lại nhãn/));
  });

  it("kiện thuộc bộ hiện 'Bộ x/N'; kiện nhãn cũ hiện 'Cần in lại nhãn'; bảng chỉ có kiện của xe này", async () => {
    renderFtl(
      ACTORS.warehouseStaff,
      loadingFtl({
        shipments: [
          loadShipment("SO-1-S1", [
            ftlParcel("PKG-SO-1-1", true, { kit: kit(1) }),
            ftlParcel("PKG-SO-1-2", false, { kit: kit(2), labelOutdated: true }),
            ftlParcel("PKG-SO-1-3", false),
          ]),
        ],
      }),
    );
    const card = await screen.findByRole("region", { name: `${L.shipments.title} SO-1-S1` });
    expect(within(card).getByText("Bộ 1/2")).toBeInTheDocument();
    expect(within(card).getByText("Bộ 2/2")).toBeInTheDocument();
    // Chỉ kiện có cờ nhãn cũ mới có huy hiệu; kiện thường và kiện đã lên xe thì không
    expect(within(card).getAllByText(F.parcel.labelOutdated)).toHaveLength(1);
    const rows = within(card).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[3] as HTMLElement).queryByText(/Bộ/)).not.toBeInTheDocument();
  });

  it("chuyến nguyên xe không có nút thêm lô; huỷ chuyến không dành cho xe của kế hoạch kể cả quản lý kho", async () => {
    renderFtl(ACTORS.warehouseManager, loadingFtl());
    await ready();
    expect(screen.queryByRole("button", { name: L.load.addShipments })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.load.removeShipment })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.load.actions.cancel })).not.toBeInTheDocument();
  });
});

describe("Chuyến nguyên xe — dỡ kiện của đơn đã huỷ", () => {
  const withPending = () => loadingFtl({ pendingUnloads: [pendingUnload()] });

  it("còn kiện cần dỡ: liệt kê kiện, ô quét DỠ thay ô quét lên xe, bàn giao bị khoá có lý do", async () => {
    renderFtl(ACTORS.warehouseStaff, withPending());
    expect(await screen.findByLabelText(F.unload.label)).toBeInTheDocument();
    expect(screen.queryByLabelText(L.scan.label)).not.toBeInTheDocument();
    const table = screen.getByRole("table", { name: F.unload.title });
    expect(within(table).getByText("PKG-SO-9-1")).toBeInTheDocument();
    expect(within(table).getByText("SO-9-S1")).toBeInTheDocument();
    const handover = screen.getByRole("button", { name: L.load.actions.handover });
    expect(handover).toBeDisabled();
    expect(handover).toHaveAttribute("title", F.disabledReason.unloadPending);
  });

  it("quét dỡ → POST /unloads {packageCode} in hoa; hết kiện cần dỡ thì ô quét lên xe trở lại", async () => {
    const user = userEvent.setup();
    const { post } = renderFtl(ACTORS.warehouseStaff, withPending(), {
      unloads: () => loadingFtl({ version: 6 }),
    });
    await user.type(await screen.findByLabelText(F.unload.label), "pkg-so-9-1{Enter}");
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/unloads`, { packageCode: "PKG-SO-9-1" }),
    );
    expect(await screen.findByLabelText(L.scan.label)).toBeInTheDocument();
    expect(screen.queryByLabelText(F.unload.label)).not.toBeInTheDocument();
  });

  it("kiện không nằm trong danh sách cần dỡ (409 PACKAGE_NOT_IN_LOAD) → câu riêng của màn dỡ, panel giữ nguyên", async () => {
    const user = userEvent.setup();
    const { post } = renderFtl(ACTORS.warehouseStaff, withPending());
    post.mockRejectedValueOnce(new ApiError(409, "PACKAGE_NOT_IN_LOAD", "en"));
    await user.type(await screen.findByLabelText(F.unload.label), "PKG-SO-1-1{Enter}");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(`PKG-SO-1-1 — ${F.unload.notPending}`),
    );
    expect(screen.getByLabelText(F.unload.label)).toBeInTheDocument();
  });

  it("không có quyền dỡ: chỉ xem danh sách kiện, không có ô quét", async () => {
    renderFtl(ACTORS.orderCoordinator, withPending());
    expect(await screen.findByText(F.unload.readOnly)).toBeInTheDocument();
    expect(screen.queryByLabelText(F.unload.label)).not.toBeInTheDocument();
    expect(screen.getByText("PKG-SO-9-1")).toBeInTheDocument();
  });

  it("đủ kiện, không còn kiện cần dỡ → bàn giao mở", async () => {
    renderFtl(
      ACTORS.warehouseStaff,
      loadingFtl({
        shipments: [loadShipment("SO-1-S1", [ftlParcel("PKG-SO-1-1", true)])],
      }),
    );
    await ready();
    expect(screen.getByRole("button", { name: L.load.actions.handover })).toBeEnabled();
  });
});

describe("Biên bản theo xe", () => {
  it("hiện kế hoạch + xe số + loại xe, ghi chú chỉ gồm kiện của xe, COD 0; kiện thuộc bộ / nhãn cũ có huy hiệu", async () => {
    mockShippingApi(ACTORS.warehouseStaff, {
      get: {
        [`${PATH}/manifest`]: () =>
          ftlManifest({
            shipments: [
              {
                shipmentCode: "SO-1-S1",
                orderNumber: "SO-1",
                packageCount: 2,
                codAmount: 0,
                codChangedSinceLabel: false,
                packages: [
                  { labelCode: "PKG-SO-1-1", loaded: true, kit: kit(1) },
                  { labelCode: "PKG-SO-1-2", loaded: true, labelOutdated: true },
                ],
              },
            ],
            packageCount: 2,
          }),
      },
    });
    renderShippingScreen(<ManifestScreen id={FTL_ID} />);
    expect(await screen.findByText("LP-2026-0001 · xe số 1")).toBeInTheDocument();
    expect(screen.getByText("TRUCK-1T25")).toBeInTheDocument();
    expect(screen.getByText(F.manifest.perVehicleNote)).toBeInTheDocument();
    expect(screen.getByText("Bộ 1/2")).toBeInTheDocument();
    expect(screen.getByText(F.parcel.labelOutdated)).toBeInTheDocument();
  });

  it("biên bản chuyến gửi kiện không có phần xe của kế hoạch", async () => {
    mockShippingApi(ACTORS.warehouseStaff, {
      get: { [`${PATH}/manifest`]: () => ftlManifest({ mode: "PARCEL" }) },
    });
    renderShippingScreen(<ManifestScreen id={FTL_ID} />);
    await screen.findByRole("heading", { name: L.manifest.docTitle });
    expect(screen.queryByText(F.manifest.perVehicleNote)).not.toBeInTheDocument();
    expect(screen.queryByText(F.manifest.vehicle)).not.toBeInTheDocument();
  });
});
