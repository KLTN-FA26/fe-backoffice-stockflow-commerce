import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SHIPPING_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useRejectedScansStore } from "@/features/shipping/rejected-scans-store";
import { resetScanIds } from "@/features/shipping/scan-ids";

import {
  FTL_ID,
  blockedOrder,
  ftlLoad,
  ftlRow,
  loadingFtl,
  plannedLoad,
} from "../__fixtures__/ftl-load";
import { apiManifest, loadShipment, parcel } from "../__fixtures__/load";
import {
  CARRIERS,
  SHIPPING_ACTORS as ACTORS,
  bePage,
  mockShippingApi,
  renderShippingScreen,
} from "../__fixtures__/render";
import { LoadScreen } from "./LoadScreen";

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
const H = L.handover;

type Routes = Parameters<typeof mockShippingApi>[1];

function renderLoad(load: Load, extra: Routes = {}) {
  const spies = mockShippingApi(ACTORS.warehouseStaff, {
    ...extra,
    get: { [PATH]: () => load, ...extra?.get },
    post: { ...extra?.post },
  });
  renderShippingScreen(<LoadScreen id={FTL_ID} />);
  return spies;
}

const ready = () => screen.findByRole("heading", { name: `${L.load.title} · ${FTL_ID}` });

const apiBooked = (patch: Partial<Load> = {}) =>
  ftlLoad({
    carrierId: "car-ahm",
    carrierCode: "AHAMOVE",
    carrierName: "Ahamove",
    carrierConnectionType: "API_BOOKING",
    vehiclePlate: undefined,
    driverName: undefined,
    driverPhone: undefined,
    ...patch,
  });

describe("S18-1: nút Xác nhận bàn giao nói vì sao đang khoá (R7)", () => {
  it("còn đơn chưa thu tiền dù đã quét đủ: nút khoá, dưới nút có số tiền, ai xử lý và liên kết tới đơn", async () => {
    const load = loadingFtl({
      waybillNo: "GHN-250001",
      shipments: [loadShipment("SO-2-S1", [parcel("PKG-SO-2-1", true)])],
      handoverWarnings: [blockedOrder({ amountDue: 7_560_000 })],
    });
    renderLoad(load);
    await ready();
    const button = screen.getByRole("button", { name: L.load.actions.handover });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", L.load.disabledReason.ordersBlocked);
    const lines = screen.getByText(L.load.handoverMissing.title).closest("div") as HTMLElement;
    expect(within(lines).getByRole("link", { name: "SO-2" })).toHaveAttribute(
      "href",
      "/admin/orders/ord-SO-2",
    );
    expect(lines).toHaveTextContent(/7\.560\.000/);
    expect(lines).toHaveTextContent("Kế toán lập phiếu thu");
  });

  it("còn kiện chưa quét: nêu số kiện và mã kiện, hướng đi tiếp", async () => {
    renderLoad(
      loadingFtl({
        shipments: [
          loadShipment("SO-1-S1", [
            parcel("PKG-SO-1-1", true),
            parcel("PKG-SO-1-2", false),
            parcel("PKG-SO-1-3", false),
          ]),
        ],
      }),
    );
    await ready();
    expect(
      screen.getByText(L.load.handoverMissing.unscanned(2, "PKG-SO-1-2, PKG-SO-1-3", 0)),
    ).toBeInTheDocument();
  });

  it("hết chặn thì dòng biến mất và nút mở", async () => {
    renderLoad(
      loadingFtl({
        waybillNo: "GHN-250001",
        shipments: [loadShipment("SO-1-S1", [parcel("PKG-SO-1-1", true)])],
      }),
    );
    await ready();
    expect(screen.getByRole("button", { name: L.load.actions.handover })).toBeEnabled();
    expect(screen.queryByText(L.load.handoverMissing.title)).not.toBeInTheDocument();
  });
});

describe("BR-18 / BR-23: lý do chưa bàn giao được không biến mất sau khi quét", () => {
  it("quét kiện cuối: phản hồi của BE không kèm handoverWarnings, nút vẫn khoá và dòng 'Còn thiếu' còn đó", async () => {
    const user = userEvent.setup();
    const unscanned = loadingFtl({
      waybillNo: "GHN-250001",
      shipments: [loadShipment("SO-2-S1", [parcel("PKG-SO-2-1", false)])],
      handoverWarnings: [blockedOrder({ amountDue: 7_560_000 })],
      version: 4,
    });
    // Phản hồi của scan / unscan / tài xế / mã vận đơn KHÔNG có handoverWarnings (chỉ GET và "bắt đầu xếp" có)
    const scanned: Load = {
      ...unscanned,
      loadedPackageCount: 1,
      handoverWarnings: undefined,
      shipments: [loadShipment("SO-2-S1", [parcel("PKG-SO-2-1", true)])],
      version: 5,
    };
    renderLoad(unscanned, { post: { [`${PATH}/scans`]: () => scanned } });
    await ready();
    expect(screen.getByRole("button", { name: L.load.actions.handover })).toBeDisabled();
    const input = screen.getByPlaceholderText(/Quét hoặc nhập mã kiện/);
    await user.type(input, "PKG-SO-2-1{Enter}");
    await waitFor(() =>
      expect(screen.getAllByRole("progressbar")[0]).toHaveAttribute("aria-valuenow", "1"),
    );
    // Đã đủ kiện, nhưng đơn vẫn chưa được phép đi: nút khoá, lý do vẫn nằm dưới nút
    expect(screen.getByRole("button", { name: L.load.actions.handover })).toBeDisabled();
    const lines = screen.getByText(L.load.handoverMissing.title).closest("div") as HTMLElement;
    expect(lines).toHaveTextContent(/7\.560\.000/);
    expect(lines).toHaveTextContent("Kế toán lập phiếu thu");
    expect(screen.queryByText(L.load.handoverMissing.unscanned(1, "PKG-SO-2-1", 0))).toBeNull();
  });

  it("chưa có mã vận đơn: dòng dưới nút nói nhập ở đâu; trong hộp thoại nút ký khoá và 'Còn thiếu' nêu mã vận đơn", async () => {
    const user = userEvent.setup();
    renderLoad(
      loadingFtl({
        waybillNo: undefined,
        shipments: [loadShipment("SO-1-S1", [parcel("PKG-SO-1-1", true)])],
      }),
    );
    await ready();
    const lines = screen.getByText(L.load.handoverMissing.title).closest("div") as HTMLElement;
    expect(within(lines).getByText(L.load.handoverMissing.waybill)).toBeInTheDocument();
    // Nút còn mở để vào hộp thoại nhập mã vận đơn (BE sẽ từ chối nếu ký ngay)
    await user.click(screen.getByRole("button", { name: L.load.actions.handover }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox", { name: H.signerIsDriver }));
    await user.click(within(dialog).getByRole("checkbox", { name: H.signedConfirm }));
    expect(within(dialog).getByRole("button", { name: H.title })).toBeDisabled();
    expect(
      within(dialog).getByText(`${H.missing.prefix}: ${H.missing.waybill}`),
    ).toBeInTheDocument();
  });

  it("hãng đặt xe qua API chưa có mã vận đơn: câu nói hãng sẽ trả mã, không mời nhập tay", async () => {
    renderLoad(
      apiBooked({
        status: "LOADING",
        waybillNo: undefined,
        shipments: [loadShipment("SO-1-S1", [parcel("PKG-SO-1-1", true)])],
      }),
    );
    await ready();
    expect(screen.getByText(L.load.handoverMissing.waybillApi)).toBeInTheDocument();
  });
});

describe("Lỗi hãng ở thẻ 'Đơn ở hãng'", () => {
  it("lỗi thô '406 CODE' không hiện: chỉ còn lời hãng, hoặc câu chung khi hãng chỉ gửi mã", async () => {
    renderLoad(
      apiBooked({
        status: "PLANNED",
        carrierBooking: { status: "FAILED", lastError: "406 INVALID_SERVICE_HOUR" },
      }),
    );
    await ready();
    expect(screen.queryByText(/INVALID_SERVICE_HOUR|406/)).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(L.waybill.apiBooking.notice.lastError))).toHaveTextContent(
      SHIPPING_ERROR_MESSAGES.CARRIER_BOOKING_FAILED,
    );
  });
});

describe("S17-5: thẻ Đặt xe với hãng", () => {
  it("hãng API đã đặt: 'Đặt xe tự động qua Ahamove', tài xế 'Chờ hãng cập nhật', biển số nhập khi ký; không lặp mã hãng, một nút chính", async () => {
    renderLoad(apiBooked());
    await ready();
    const card = screen.getByRole("heading", { name: F.booking.title }).closest("section");
    const inside = within(card as HTMLElement);
    expect(inside.getByText(F.booking.automaticVia("Ahamove"))).toBeInTheDocument();
    expect(inside.getByText(F.booking.plateAtHandover)).toBeInTheDocument();
    expect(inside.getAllByText(F.booking.waitCarrier).length).toBeGreaterThan(0);
    // Tên hãng, không "AHAMOVE Ahamove"
    expect(screen.queryByText("AHAMOVE Ahamove")).not.toBeInTheDocument();
    expect(inside.getByText("Ahamove")).toHaveAttribute("title", "AHAMOVE");
    // Trạng thái chuyến chỉ ở thẻ thông tin đầu trang, không lặp trong thẻ này
    expect(inside.queryByText("Đã đặt xe")).not.toBeInTheDocument();
    // "Nhập tài xế" không còn là nút chính cạnh "Bắt đầu xếp hàng"
    expect(inside.getByRole("button", { name: F.booking.enterDriver }).className).not.toMatch(
      /bg-brand/,
    );
    expect(inside.getByRole("button", { name: F.booking.start }).className).toMatch(/bg-brand/);
  });

  it("hãng thường: biển số / tài xế chưa có vẫn là '—', không 'Chờ hãng cập nhật'", async () => {
    renderLoad(ftlLoad({ vehiclePlate: undefined, driverName: undefined }));
    await ready();
    const card = screen.getByRole("heading", { name: F.booking.title }).closest("section");
    expect(within(card as HTMLElement).queryByText(F.booking.waitCarrier)).not.toBeInTheDocument();
  });

  it("SĐT tài xế hiện '0911 111 110', không '84911111110'", async () => {
    renderLoad(apiBooked({ driverName: "Test Driver", driverPhone: "84911111110" }));
    await ready();
    expect(screen.getAllByText("0911 111 110").length).toBeGreaterThan(0);
    expect(screen.queryByText("84911111110")).not.toBeInTheDocument();
  });
});

describe("S17-3 / S17-2 / S17-4: hộp thoại đặt xe", () => {
  it("chỉ một hãng đang dùng → chọn sẵn, không phải mở danh sách", async () => {
    const user = userEvent.setup();
    renderLoad(plannedLoad(), {
      get: { "/fulfillment/carriers": () => bePage([CARRIERS[0]]) },
    });
    await user.click(await screen.findByRole("button", { name: F.booking.book }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("combobox")).toHaveTextContent("Giao Hàng Nhanh");
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: F.bookDialog.submit })).toBeEnabled(),
    );
  });

  it("nhiều hãng: không chọn sẵn; hãng dùng gần nhất của kho nằm đầu danh sách", async () => {
    const user = userEvent.setup();
    renderLoad(plannedLoad(), {
      get: {
        "/fulfillment/loads": () =>
          bePage([
            ftlRow({
              loadId: "old",
              status: "DISPATCHED",
              carrierId: "car-ghn",
              dispatchedAt: "2026-11-10T03:00:00Z",
            }),
            ftlRow({
              loadId: "recent",
              status: "DISPATCHED",
              carrierId: "car-vtp",
              dispatchedAt: "2026-11-24T03:00:00Z",
            }),
          ]),
      },
    });
    await user.click(await screen.findByRole("button", { name: F.booking.book }));
    const dialog = await screen.findByRole("dialog");
    const trigger = within(dialog).getByRole("combobox");
    expect(trigger).not.toHaveTextContent("Viettel Post");
    await user.click(trigger);
    await waitFor(() =>
      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
        "Viettel Post",
        "Giao Hàng Nhanh",
        "Ahamove",
      ]),
    );
  });

  it("lỗi hãng BE đã dịch hiện nguyên văn; giờ hẹn ngoài giờ phục vụ đánh dấu ô giờ", async () => {
    const user = userEvent.setup();
    const advice =
      "Giờ hẹn lấy hàng không nằm trong giờ phục vụ của hãng. Nhân viên kho chọn giờ hẹn khác ở ô “Giờ hẹn lấy hàng” rồi bấm “Tạo đơn ở hãng” lại.";
    const { post } = renderLoad(plannedLoad(), {
      get: { [`${PATH}/manifest`]: () => apiManifest({ loadCode: FTL_ID }) },
    });
    post.mockRejectedValueOnce(
      new ApiError(422, "CARRIER_BOOKING_FAILED", advice, { carrier: advice }, undefined, {
        carrier: "INVALID_SERVICE_HOUR",
      }),
    );
    await user.click(await screen.findByRole("button", { name: F.booking.book }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /Ahamove/ }));
    await user.click(within(dialog).getByRole("button", { name: L.waybill.apiBooking.submit }));
    expect(await within(dialog).findByText(advice)).toBeInTheDocument();
    expect(within(dialog).getByText(L.waybill.apiBooking.pickupAtOutOfHours)).toBeInTheDocument();
    expect(within(dialog).queryByText(/INVALID_SERVICE_HOUR|406/)).not.toBeInTheDocument();
  });

  it("một điểm giao: không mũi tên lên / xuống; tên người nhận + địa chỉ lấy từ biên bản; số đơn không lặp cạnh mã lô", async () => {
    const user = userEvent.setup();
    renderLoad(plannedLoad(), {
      get: {
        [`${PATH}/manifest`]: () =>
          apiManifest({
            loadCode: FTL_ID,
            shipments: [
              {
                shipmentCode: "SO-1-S1",
                orderNumber: "SO-1",
                recipientName: "Vũ Đức Long",
                recipientPhone: "0966777888",
                deliveryAddress: "15 Quang Trung, Hà Đông, Hà Nội",
                packageCount: 2,
                weightKg: 2.3,
                packages: [],
              },
            ],
          }),
      },
    });
    await user.click(await screen.findByRole("button", { name: F.booking.book }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /Ahamove/ }));
    expect(await within(dialog).findByText(/Vũ Đức Long — 15 Quang Trung/)).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: L.waybill.apiBooking.upAria("SO-1-S1") }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: L.waybill.apiBooking.downAria("SO-1-S1") }),
    ).not.toBeInTheDocument();
    // "SO-1-S1" một lần, không "SO-1-S1 SO-1"
    expect(within(dialog).getAllByText("SO-1-S1")).toHaveLength(1);
    expect(within(dialog).queryByText("SO-1")).not.toBeInTheDocument();
  });
});

describe("S18-4: hộp 'Xe đã bàn giao'", () => {
  it("một câu 'Đã bàn giao N kiện cho <hãng>', nút Xem biên bản và Đóng", async () => {
    const user = userEvent.setup();
    const full = loadingFtl({
      waybillNo: "GHN-250001",
      shipments: [
        loadShipment("SO-1-S1", [parcel("PKG-SO-1-1", true), parcel("PKG-SO-1-2", true)]),
      ],
    });
    const done: Load = {
      ...full,
      status: "DISPATCHED",
      shipments: [
        loadShipment("SO-1-S1", [parcel("PKG-SO-1-1", true), parcel("PKG-SO-1-2", true)], {
          status: "HANDED_OVER",
        }),
      ],
    };
    renderLoad(full, { post: { [`${PATH}/handover`]: () => done } });
    await user.click(await screen.findByRole("button", { name: L.load.actions.handover }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox", { name: H.signerIsDriver }));
    await user.click(within(dialog).getByRole("checkbox", { name: H.signedConfirm }));
    await user.click(within(dialog).getByRole("button", { name: H.title }));
    const result = await screen.findByRole("dialog", { name: new RegExp(F.handover.doneTitle) });
    expect(
      within(result).getByText(F.handover.doneSummary(2, "Giao Hàng Nhanh")),
    ).toBeInTheDocument();
    // "Đã bàn giao" không lặp ba lần như trước: tiêu đề + câu tóm tắt + trạng thái lô
    expect(within(result).getByRole("link", { name: H.done.manifest })).toHaveAttribute(
      "href",
      `/admin/loads/${FTL_ID}/manifest`,
    );
    expect(within(result).getByRole("button", { name: H.done.close })).toBeInTheDocument();
  });
});
