import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SHIPPING_ERROR_MESSAGES as ERR, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { useRejectedScansStore } from "@/features/shipping/rejected-scans-store";
import { resetScanIds } from "@/features/shipping/scan-ids";

import { LOAD_ID, apiLoad, loadShipment, parcel } from "../__fixtures__/load";
import {
  SHIPPING_ACTORS as ACTORS,
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

const PATH = `/fulfillment/loads/${LOAD_ID}`;
const L = UI_LABELS.shipping;
const H = L.handover;
const FTL = L.ftl.handover;
const W = L.waybill;
const M = W.missingWaybill;
const B = W.blocked;
/** jest-dom gộp khoảng trắng (kể cả NBSP của tiền tệ) trong nội dung phần tử — chuẩn hoá chuỗi mong đợi giống vậy. */
const flat = (text: string) => text.replace(/\s+/g, " ");

const ready = (patch: Partial<Load> = {}) =>
  apiLoad({
    shipments: [
      loadShipment("SO-1-S1", [parcel("PKG-SO-1-1", true)]),
      loadShipment("SO-2-S1", [parcel("PKG-SO-2-1", true)]),
    ],
    ...patch,
  });

function renderHandover(load: Load, handover: (body: Record<string, unknown>) => unknown) {
  const spies = mockShippingApi(ACTORS.warehouseStaff, {
    get: { [PATH]: () => load },
    post: { [`${PATH}/handover`]: (_p, body) => handover(body as Record<string, unknown>) },
  });
  renderShippingScreen(<LoadScreen id={LOAD_ID} />);
  return spies;
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: L.load.actions.handover }));
  return screen.getByRole("dialog");
}

describe("nút bàn giao", () => {
  it("khoá có lý do khi còn kiện chưa quét; mở khi đủ", async () => {
    renderHandover(apiLoad(), () => apiLoad());
    const button = await screen.findByRole("button", { name: L.load.actions.handover });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", L.load.disabledReason.notFullyLoaded);
  });

  it("chuyến chưa có lô → khoá, lý do 'chưa có lô'", async () => {
    renderHandover(apiLoad({ shipments: [] }), () => apiLoad());
    const button = await screen.findByRole("button", { name: L.load.actions.handover });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", L.load.disabledReason.empty);
  });
});

describe("hộp thoại bàn giao", () => {
  it("điền sẵn tài xế / biển số của chuyến; nút xác nhận khoá tới khi tick đã ký", async () => {
    const user = userEvent.setup();
    renderHandover(ready({ driverPhone: "0903111222" }), () => ready());
    const dialog = await openDialog(user);
    expect(within(dialog).getByLabelText(H.representative, { exact: false })).toHaveValue(
      "Lê Văn Xế",
    );
    expect(within(dialog).getByLabelText(H.vehiclePlate, { exact: false })).toHaveValue(
      "51C-628.14",
    );
    expect(within(dialog).getByLabelText(H.driverPhone, { exact: false })).toHaveValue(
      "0903111222",
    );
    const submit = within(dialog).getByRole("button", { name: H.title });
    expect(submit).toBeDisabled();
    await user.click(within(dialog).getByRole("checkbox"));
    await waitFor(() => expect(submit).toBeEnabled());
  });

  it("chuyến chưa ghi biển số → biển số bắt buộc", async () => {
    const user = userEvent.setup();
    renderHandover(ready({ vehiclePlate: undefined, driverName: undefined }), () => ready());
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(H.representative, { exact: false }), "Anh Tài");
    await user.click(within(dialog).getByRole("checkbox"));
    expect(within(dialog).getByRole("button", { name: H.title })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(H.vehiclePlate, { exact: false }), "51D-1");
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: H.title })).toBeEnabled(),
    );
  });

  it("gửi version lúc mở hộp thoại cùng người ký, biển số, mã biên bản, ghi chú; thành công → hiện DISPATCHED và trạng thái từng lô", async () => {
    const user = userEvent.setup();
    const dispatched = ready({
      status: "DISPATCHED",
      version: 5,
      dispatchedAt: "2026-10-21T03:00:00Z",
      shipments: [
        loadShipment("SO-1-S1", [parcel("PKG-SO-1-1", true)], { status: "HANDED_OVER" }),
        loadShipment("SO-2-S1", [parcel("PKG-SO-2-1", true)], { status: "READY_TO_DISPATCH" }),
      ],
    });
    const { post } = renderHandover(ready(), () => dispatched);
    const dialog = await openDialog(user);
    await user.clear(within(dialog).getByLabelText(H.representative, { exact: false }));
    await user.type(
      within(dialog).getByLabelText(H.representative, { exact: false }),
      "Trần Văn Tài",
    );
    await user.type(within(dialog).getByLabelText(H.signatureRef, { exact: false }), "BB-2026-9");
    await user.type(within(dialog).getByLabelText(H.note), "Hàng dễ vỡ");
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: H.title }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(`${PATH}/handover`, {
      version: 4,
      carrierRepresentative: "Trần Văn Tài",
      vehiclePlate: "51C-628.14",
      driverPhone: undefined,
      signatureRef: "BB-2026-9",
      note: "Hàng dễ vỡ",
      signed: true,
    });
    const done = await screen.findByRole("dialog", { name: new RegExp(FTL.doneTitle) });
    const rows = within(done).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(FTL.shipmentStatus.HANDED_OVER);
    expect(rows[1]).toHaveTextContent(FTL.shipmentStatus.READY_TO_DISPATCH);
    expect(within(done).getByRole("link", { name: "SO-1-S1" })).toHaveAttribute(
      "href",
      "/admin/shipments/shp-SO-1-S1",
    );
    expect(within(done).queryByText(/COD/i)).not.toBeInTheDocument();
    expect(within(done).getByRole("link", { name: H.done.manifest })).toHaveAttribute(
      "href",
      `/admin/loads/${LOAD_ID}/manifest`,
    );
    await user.click(within(done).getByRole("button", { name: H.done.close }));
    // Sau khi đóng: chuyến hiện DISPATCHED, không còn nút bàn giao
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: L.load.actions.handover }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText(L.load.noActions.dispatched)).toBeInTheDocument();
  });

  it("lỗi nêu tên lô (ORDER_BALANCE_NOT_PAID): hiện theo lô trong hộp thoại và đánh dấu lô trên màn chuyến", async () => {
    const user = userEvent.setup();
    renderHandover(ready(), () => {
      throw new ApiError(409, "ORDER_BALANCE_NOT_PAID", "en", { shipmentCode: "SO-2-S1" });
    });
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: H.title }));
    const message = `Lô SO-2-S1: ${ERR.ORDER_BALANCE_NOT_PAID}`;
    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Huỷ" }));
    const card = await screen.findByRole("region", { name: `${L.shipments.title} SO-2-S1` });
    expect(within(card).getByText(message)).toBeInTheDocument();
    const other = screen.getByRole("region", { name: `${L.shipments.title} SO-1-S1` });
    expect(within(other).queryByText(L.load.refusalTitle)).not.toBeInTheDocument();
  });

  it("OPTIMISTIC_LOCK (có người đổi chuyến khi đang ký) → giữ các ô đã nhập, bỏ tick đã ký; ký lại dùng version đã tải lại", async () => {
    const user = userEvent.setup();
    let current = ready();
    let attempts = 0;
    const { get, post } = mockShippingApi(ACTORS.warehouseStaff, {
      get: { [PATH]: () => current },
      post: {
        [`${PATH}/handover`]: () => {
          attempts += 1;
          if (attempts > 1) return ready({ status: "DISPATCHED" });
          current = ready({ version: 5 });
          throw new ApiError(409, "OPTIMISTIC_LOCK", "en");
        },
      },
    });
    renderShippingScreen(<LoadScreen id={LOAD_ID} />);
    const dialog = await openDialog(user);
    const rep = within(dialog).getByLabelText(H.representative, { exact: false });
    await user.clear(rep);
    await user.type(rep, "Trần Văn Tài");
    await user.type(within(dialog).getByLabelText(H.signatureRef, { exact: false }), "BB-9");
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: H.title }));
    expect(await within(dialog).findByText(ERR.OPTIMISTIC_LOCK)).toBeInTheDocument();
    // Hộp thoại còn nguyên, ô đã nhập còn, tick đã ký bị bỏ → nút khoá tới khi hai bên xem lại và tick lại
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(rep).toHaveValue("Trần Văn Tài");
    expect(within(dialog).getByLabelText(H.signatureRef, { exact: false })).toHaveValue("BB-9");
    expect(within(dialog).getByRole("checkbox")).not.toBeChecked();
    expect(within(dialog).getByRole("button", { name: H.title })).toBeDisabled();
    await waitFor(() =>
      expect(get.mock.calls.filter(([url]) => url === PATH).length).toBeGreaterThan(1),
    );
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: H.title }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1]?.[1]).toMatchObject({
      version: 5,
      carrierRepresentative: "Trần Văn Tài",
      signatureRef: "BB-9",
    });
  });

  it("lỗi phía đơn có tên lô nhưng mã chưa biết → vẫn đánh dấu lô, lý do chung", async () => {
    const user = userEvent.setup();
    renderHandover(ready(), () => {
      throw new ApiError(409, "ORDER_UNMAPPED_REASON", "en", { shipmentCode: "SO-2-S1" });
    });
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: H.title }));
    const message = `Lô SO-2-S1: ${ERR.shipmentRefused}`;
    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Huỷ" }));
    const card = await screen.findByRole("region", { name: `${L.shipments.title} SO-2-S1` });
    expect(within(card).getByText(message)).toBeInTheDocument();
  });

  it("BE báo chưa ký (400 HANDOVER_NOT_SIGNED) → hiện câu nhắc ký, hộp thoại còn mở", async () => {
    const user = userEvent.setup();
    renderHandover(ready(), () => {
      throw new ApiError(400, "HANDOVER_NOT_SIGNED", "en");
    });
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: H.title }));
    expect(await within(dialog).findByText(ERR.HANDOVER_NOT_SIGNED)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("lỗi theo ô của BE (400 VALIDATION_FAILED) hiện đúng ô", async () => {
    const user = userEvent.setup();
    renderHandover(ready(), () => {
      throw new ApiError(400, "VALIDATION_FAILED", "en", { signatureRef: "quá dài" });
    });
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: H.title }));
    expect(await within(dialog).findByText("quá dài")).toBeInTheDocument();
    expect(within(dialog).getByText(ERR.VALIDATION_FAILED)).toBeInTheDocument();
  });

  it("chưa tick đã ký → không gửi được (nút khoá, không gọi API)", async () => {
    const user = userEvent.setup();
    const { post } = renderHandover(ready(), () => ready());
    const dialog = await openDialog(user);
    const submit = within(dialog).getByRole("button", { name: H.title });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(post).not.toHaveBeenCalled();
  });

  it("xoá người ký bên hãng → không gửi được", async () => {
    const user = userEvent.setup();
    renderHandover(ready(), () => ready());
    const dialog = await openDialog(user);
    await user.clear(within(dialog).getByLabelText(H.representative, { exact: false }));
    await user.click(within(dialog).getByRole("checkbox"));
    expect(within(dialog).getByRole("button", { name: H.title })).toBeDisabled();
  });
});

describe("nút bàn giao theo quyền", () => {
  it.each([
    ["warehouseStaff", true],
    ["warehouseManager", true],
    ["orderCoordinator", false],
    ["viewOnly", false],
  ] as const)("%s → nút xác nhận bàn giao hiện = %s", async (name, visible) => {
    mockShippingApi(ACTORS[name], { get: { [PATH]: () => ready() } });
    renderShippingScreen(<LoadScreen id={LOAD_ID} />);
    await screen.findByRole("link", { name: L.load.actions.manifest });
    const button = screen.queryByRole("button", { name: L.load.actions.handover });
    if (visible) expect(button).toBeEnabled();
    else expect(button).not.toBeInTheDocument();
  });
});

describe("chuyến chưa có mã vận đơn (BR-23)", () => {
  const noWaybill = () => ready({ waybillNo: undefined });

  it("báo ngay trong hộp thoại và mời nhập mã vận đơn; bấm nút → đóng bàn giao, mở hộp thoại nhập mã", async () => {
    const user = userEvent.setup();
    renderHandover(noWaybill(), () => ready());
    const dialog = await openDialog(user);
    expect(within(dialog).getByText(M.title)).toBeInTheDocument();
    expect(within(dialog).getByText(M.description)).toBeInTheDocument();
    expect(within(dialog).queryByText(M.apiManaged)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: M.enter }));
    const waybill = await screen.findByRole("dialog", { name: new RegExp(W.dialog.title) });
    expect(
      within(waybill).getByLabelText(W.dialog.waybillNo, { exact: false }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: new RegExp(H.title) })).not.toBeInTheDocument();
  });

  it("chuyến đã có mã vận đơn → không hiện cảnh báo", async () => {
    const user = userEvent.setup();
    renderHandover(ready(), () => ready());
    const dialog = await openDialog(user);
    expect(within(dialog).queryByText(M.title)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: M.enter })).not.toBeInTheDocument();
  });

  it("hãng đặt xe qua API → hiện cảnh báo kèm giải thích, KHÔNG có nút nhập mã vận đơn", async () => {
    const user = userEvent.setup();
    renderHandover(ready({ waybillNo: undefined, carrierConnectionType: "API_BOOKING" }), () =>
      ready(),
    );
    const dialog = await openDialog(user);
    expect(within(dialog).getByText(M.title)).toBeInTheDocument();
    expect(within(dialog).getByText(M.apiManaged)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: M.enter })).not.toBeInTheDocument();
  });

  it("BE 409 LOAD_WAYBILL_MISSING (mã vừa bị xoá ở nơi khác) → hiện cảnh báo + nút nhập, không lặp câu lỗi chung", async () => {
    const user = userEvent.setup();
    renderHandover(ready(), () => {
      throw new ApiError(409, "LOAD_WAYBILL_MISSING", "en");
    });
    const dialog = await openDialog(user);
    expect(within(dialog).queryByText(M.title)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: H.title }));
    expect(await within(dialog).findByText(M.title)).toBeInTheDocument();
    expect(within(dialog).queryByText(ERR.LOAD_WAYBILL_MISSING)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: M.enter }));
    expect(
      await screen.findByRole("dialog", { name: new RegExp(W.dialog.title) }),
    ).toBeInTheDocument();
  });
});

describe("BE chặn cả xe (409 LOAD_HANDOVER_BLOCKED, BR-18)", () => {
  const blocked = (details: Record<string, unknown> | undefined) => () => {
    throw new ApiError(
      409,
      "LOAD_HANDOVER_BLOCKED",
      "en",
      undefined,
      undefined,
      undefined,
      undefined,
      details,
    );
  };

  async function submitBlocked(details: Record<string, unknown> | undefined) {
    const user = userEvent.setup();
    const spies = renderHandover(ready(), blocked(details));
    const dialog = await openDialog(user);
    const rep = within(dialog).getByLabelText(H.representative, { exact: false });
    await user.type(within(dialog).getByLabelText(H.signatureRef, { exact: false }), "BB-7");
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: H.title }));
    return { user, dialog, rep, ...spies };
  }

  it("liệt kê từng đơn chặn: số tiền còn thiếu + đợt giao, ngày mở cửa sổ giao, đơn tạm giữ; giữ hộp thoại và các ô đã nhập", async () => {
    const { dialog, rep } = await submitBlocked({
      orders: [
        {
          orderId: "ord-SO-2",
          orderNumber: "SO-2",
          reasonCode: "ORDER_BALANCE_NOT_PAID",
          amountDue: "15000000.00",
          currency: "VND",
          deliveryBatchSeq: 2,
        },
        {
          orderId: "ord-SO-3",
          orderNumber: "SO-3",
          reasonCode: "DELIVERY_BATCH_WINDOW_NOT_OPEN",
          amountDue: "0",
          currency: "VND",
          deliveryBatchSeq: 1,
          windowStart: "2026-12-05",
        },
        {
          orderId: "ord-SO-4",
          orderNumber: "SO-4",
          reasonCode: "ORDER_INVALID_TRANSITION",
          amountDue: "0",
          currency: "VND",
        },
      ],
    });
    expect(await within(dialog).findByText(B.title)).toBeInTheDocument();
    const items = within(dialog).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0]!).getByRole("link", { name: "SO-2" })).toHaveAttribute(
      "href",
      "/admin/orders/ord-SO-2",
    );
    expect(items[0]).toHaveTextContent(flat(B.unpaidBatch(formatMoney(15_000_000, "VND"), 2)));
    expect(items[0]).toHaveTextContent(/15\.000\.000/);
    expect(items[1]).toHaveTextContent(B.windowNotOpenBatch(formatDate("2026-12-05"), 1));
    expect(items[1]).toHaveTextContent(/05\/12\/2026|5 thg 12, 2026/);
    expect(items[2]).toHaveTextContent(B.onHold);
    // Không lặp câu lỗi chung; hộp thoại còn nguyên, các ô đã nhập còn
    expect(within(dialog).queryByText(ERR.LOAD_HANDOVER_BLOCKED)).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(rep).toHaveValue("Lê Văn Xế");
    expect(within(dialog).getByLabelText(H.signatureRef, { exact: false })).toHaveValue("BB-7");
  });

  it("DELIVERY_BATCH_WINDOW_NOT_OPEN không có đợt giao → câu theo ngày, không nêu đợt", async () => {
    const { dialog } = await submitBlocked({
      orders: [
        {
          orderId: "ord-SO-3",
          orderNumber: "SO-3",
          reasonCode: "DELIVERY_BATCH_WINDOW_NOT_OPEN",
          amountDue: "0",
          currency: "VND",
          windowStart: "2026-12-05",
        },
      ],
    });
    const item = await within(dialog).findByRole("listitem");
    expect(item).toHaveTextContent(B.windowNotOpen(formatDate("2026-12-05")));
    expect(item).not.toHaveTextContent(/Đợt giao 1/);
  });

  it("ORDER_BALANCE_NOT_PAID không có đợt giao → câu số tiền không nêu đợt", async () => {
    const { dialog } = await submitBlocked({
      orders: [
        {
          orderId: "ord-SO-2",
          orderNumber: "SO-2",
          reasonCode: "ORDER_BALANCE_NOT_PAID",
          amountDue: "270000",
          currency: "VND",
        },
      ],
    });
    const item = await within(dialog).findByRole("listitem");
    expect(item).toHaveTextContent(flat(B.unpaid(formatMoney(270_000, "VND"))));
  });

  it.each([
    ["thiếu orders", {}],
    ["orders không phải mảng", { orders: "SO-2" }],
    ["phần tử thiếu orderNumber", { orders: [{ orderId: "x", reasonCode: "ORDER_CANCELLED" }] }],
    ["không có details", undefined],
  ])(
    "details sai hình (%s) → không có danh sách, hiện câu lỗi chung, không vỡ",
    async (_n, details) => {
      const { dialog } = await submitBlocked(details);
      expect(await within(dialog).findByText(ERR.LOAD_HANDOVER_BLOCKED)).toBeInTheDocument();
      expect(within(dialog).queryByText(B.title)).not.toBeInTheDocument();
      expect(within(dialog).queryByRole("listitem")).not.toBeInTheDocument();
    },
  );

  it("gửi lại sau khi xử lý xong: danh sách cũ biến mất khi lần gửi sau thành công", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const { post } = renderHandover(ready(), () => {
      attempts += 1;
      if (attempts === 1) {
        return blocked({
          orders: [
            {
              orderId: "ord-SO-2",
              orderNumber: "SO-2",
              reasonCode: "ORDER_INVALID_TRANSITION",
            },
          ],
        })();
      }
      return ready({ status: "DISPATCHED" });
    });
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: H.title }));
    expect(await within(dialog).findByText(B.title)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: H.title }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByRole("dialog", { name: new RegExp(FTL.doneTitle) }),
    ).toBeInTheDocument();
    expect(screen.queryByText(B.title)).not.toBeInTheDocument();
  });
});
