import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SHIPPING_ERROR_MESSAGES as ERR,
  SHIPPING_FIELD_MESSAGES as FIELD,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useRejectedScansStore } from "@/features/shipping/rejected-scans-store";

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
  sessionStorage.clear();
});

const PATH = `/fulfillment/loads/${LOAD_ID}`;
const L = UI_LABELS.shipping;
const H = L.handover;

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

  it("gửi version lúc mở hộp thoại cùng người ký, biển số, mã biên bản, ghi chú; thành công → hiện DISPATCHED và các lô", async () => {
    const user = userEvent.setup();
    const dispatched = ready({
      status: "DISPATCHED",
      version: 5,
      dispatchedAt: "2026-10-21T03:00:00Z",
      shipments: [
        loadShipment("SO-1-S1", [parcel("PKG-SO-1-1", true)], {
          status: "HANDED_OVER",
          codAmount: 270_000,
        }),
        loadShipment("SO-2-S1", [parcel("PKG-SO-2-1", true)], {
          status: "HANDED_OVER",
          codAmount: 0,
        }),
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
    const done = await screen.findByRole("dialog", { name: new RegExp(H.done.title) });
    expect(within(done).getByText("Đã bàn giao")).toBeInTheDocument();
    expect(within(done).getByRole("link", { name: "SO-1-S1" })).toHaveAttribute(
      "href",
      "/admin/shipments/shp-SO-1-S1",
    );
    expect(within(done).getByText(/270\.000/)).toBeInTheDocument();
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

  it("LABEL_OUTDATED: nêu đúng lô, đánh dấu lô trên màn chuyến, có lối in lại nhãn", async () => {
    const user = userEvent.setup();
    renderHandover(ready(), () => {
      throw new ApiError(409, "LABEL_OUTDATED", "en", { shipmentCode: "SO-2-S1" });
    });
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: H.title }));
    const message = `Lô SO-2-S1: ${ERR.LABEL_OUTDATED}`;
    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: new RegExp(L.load.reprintLabel) }),
    ).toHaveAttribute("href", "/admin/picking");
    await user.click(within(dialog).getByRole("button", { name: "Huỷ" }));
    // Lô bị chặn được đánh dấu ngay trên chuyến; lô còn lại thì không
    const card = await screen.findByRole("region", { name: `${L.shipments.title} SO-2-S1` });
    expect(within(card).getByText(message)).toBeInTheDocument();
    expect(
      within(card).getByRole("link", { name: new RegExp(L.load.reprintLabel) }),
    ).toBeInTheDocument();
    const other = screen.getByRole("region", { name: `${L.shipments.title} SO-1-S1` });
    expect(within(other).queryByText(L.load.refusalTitle)).not.toBeInTheDocument();
  });

  it("chưa thanh toán đủ: lỗi theo lô, không có lối in nhãn", async () => {
    const user = userEvent.setup();
    renderHandover(ready(), () => {
      throw new ApiError(409, "ORDER_BALANCE_NOT_PAID", "en", { shipmentCode: "SO-1-S1" });
    });
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: H.title }));
    expect(
      await within(dialog).findByText(`Lô SO-1-S1: ${ERR.ORDER_BALANCE_NOT_PAID}`),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("link", { name: new RegExp(L.load.reprintLabel) }),
    ).not.toBeInTheDocument();
  });

  it("OPTIMISTIC_LOCK (có người đổi chuyến khi đang ký) → đóng hộp thoại và tải lại chuyến", async () => {
    const user = userEvent.setup();
    const { get } = renderHandover(ready(), () => {
      throw new ApiError(409, "OPTIMISTIC_LOCK", "en");
    });
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: H.title }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const before = get.mock.calls.filter(([url]) => url === PATH).length;
    expect(before).toBeGreaterThan(1);
  });

  it("chưa ký (400 HANDOVER_NOT_SIGNED) và lỗi theo ô của BE hiện đúng chỗ", async () => {
    const user = userEvent.setup();
    renderHandover(ready(), () => {
      throw new ApiError(400, "VALIDATION_FAILED", "en", { signatureRef: "quá dài" });
    });
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: H.title }));
    expect(await within(dialog).findByText("quá dài")).toBeInTheDocument();
    expect(within(dialog).getByText(ERR.VALIDATION_FAILED)).toBeInTheDocument();
    expect(FIELD.signedRequired).toBeTruthy();
  });
});
