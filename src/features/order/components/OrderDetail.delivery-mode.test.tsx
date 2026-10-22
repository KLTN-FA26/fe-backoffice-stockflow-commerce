/**
 * Màn chi tiết đơn — hình thức giao (BE PR #157, LP-1/LP-2): thẻ + hộp thoại đổi (mã quyền
 * sales-order-delivery-modes:UPDATE), trạng thái khoá kèm lý do, lỗi 409, mục lịch sử DELIVERY_MODE_CHANGE, và khe
 * "Ước tính xếp xe" của đơn đã release.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { DETAIL_PATH, renderDetail } from "../__fixtures__/detail";
import { apiOrder, apiOrderDelivery } from "../__fixtures__/order";
import { ORDER_PERMISSION_SETS } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const MODE_PATH = `${DETAIL_PATH}/delivery-mode`;
const OPEN_PARCEL = { deliveryMode: "PARCEL", deliveryModeLocked: false } as const;

describe("OrderDetail — thẻ 'Hình thức giao'", () => {
  it("ai đọc được đơn đều thấy hình thức (nhãn 'Giao lẻ' / 'Nguyên xe (FTL)'); thiếu mã quyền → không có nút đổi", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () =>
      apiOrderDelivery("PICKING", { deliveryMode: "FULL_TRUCKLOAD", deliveryModeLocked: false }),
    );
    const card = await screen.findByRole("region", { name: "Hình thức giao" });
    expect(within(card).getByText("Nguyên xe (FTL)")).toBeInTheDocument();
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/identity/me/permissions", expect.anything()),
    );
    expect(
      within(card).queryByRole("button", { name: "Đổi hình thức giao" }),
    ).not.toBeInTheDocument();
  });

  it("điều phối viên có mã quyền → đổi + ghi chú → PUT {deliveryMode, note}; toast, dialog đóng, đơn và lịch sử tải lại", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinatorWithModes, () =>
      apiOrderDelivery("PICKING", OPEN_PARCEL),
    );
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: apiOrder });
    const toastSuccess = vi.spyOn(toast, "success");
    const user = userEvent.setup();

    const card = await screen.findByRole("region", { name: "Hình thức giao" });
    expect(within(card).getByText("Giao lẻ")).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Đổi hình thức giao" }));
    const dialog = await screen.findByRole("dialog");
    // mở sẵn với hình thức NGƯỢC hiện tại
    expect(within(dialog).getByRole("radio", { name: /Nguyên xe \(FTL\)/ })).toBeChecked();
    await user.type(within(dialog).getByLabelText(/Ghi chú/), "  Khách lấy 2 container  ");
    await user.click(within(dialog).getByRole("button", { name: "Đổi hình thức" }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(MODE_PATH, {
        deliveryMode: "FULL_TRUCKLOAD",
        note: "Khách lấy 2 container",
      }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã đổi hình thức giao"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === DETAIL_PATH)).toHaveLength(2),
    );
  });

  it("không ghi chú → body không có note", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinatorWithModes, () =>
      apiOrderDelivery("PICKING", { deliveryMode: "FULL_TRUCKLOAD", deliveryModeLocked: false }),
    );
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: apiOrder });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Đổi hình thức giao" }));
    await user.click(await screen.findByRole("button", { name: "Đổi hình thức" }));
    await waitFor(() => expect(put).toHaveBeenCalledWith(MODE_PATH, { deliveryMode: "PARCEL" }));
  });

  it("hình thức chọn trùng hình thức hiện tại → nút Đổi bị khoá (không gửi gì)", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinatorWithModes, () =>
      apiOrderDelivery("PICKING", OPEN_PARCEL),
    );
    const put = vi.spyOn(api, "put");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Đổi hình thức giao" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: /Giao lẻ/ }));
    expect(within(dialog).getByRole("button", { name: "Đổi hình thức" })).toBeDisabled();
    expect(
      within(dialog).getByText(/Chọn hình thức khác với hình thức hiện tại/),
    ).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it("deliveryModeLocked → nói rõ lý do, không có nút đổi dù có mã quyền", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinatorWithModes, () =>
      apiOrderDelivery("PICKING", { deliveryMode: "FULL_TRUCKLOAD", deliveryModeLocked: true }),
    );
    const card = await screen.findByRole("region", { name: "Hình thức giao" });
    expect(within(card).getByText(/kho đã bắt đầu đóng gói/)).toBeInTheDocument();
    expect(within(card).getByText(/Đã khoá/)).toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "Đổi hình thức giao" }),
    ).not.toBeInTheDocument();
  });

  it("BE không trả hình thức → không hiện thẻ (không đoán)", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinatorWithModes, () => apiOrder);
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.queryByRole("region", { name: "Hình thức giao" })).not.toBeInTheDocument();
  });

  it("409 DELIVERY_MODE_FTL_NO_COD → giữ dialog, báo 'Sale đổi cách thu trước' bằng tiếng Việt", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinatorWithModes, () =>
      apiOrderDelivery("PICKING", OPEN_PARCEL, {
        paymentTerm: "DEPOSIT",
        balancePolicy: "ON_DELIVERY",
      }),
    );
    vi.spyOn(api, "put").mockRejectedValue(
      new ApiError(409, "DELIVERY_MODE_FTL_NO_COD", "English server message"),
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Đổi hình thức giao" }));
    const dialog = await screen.findByRole("dialog");
    // báo trước ngay khi chọn FTL cho đơn thu COD
    expect(within(dialog).getByRole("status")).toHaveTextContent(/Sale đổi cách thu trước/);
    await user.click(within(dialog).getByRole("button", { name: "Đổi hình thức" }));
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent(
      "Đơn thu tiền khi giao (COD) không giao nguyên xe được — Sale đổi cách thu trước.",
    );
    expect(screen.queryByText("English server message")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("409 DELIVERY_MODE_LOCKED → đóng dialog, tải lại đơn và báo khoá bằng toast", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinatorWithModes, () =>
      apiOrderDelivery("PICKING", OPEN_PARCEL),
    );
    vi.spyOn(api, "put").mockRejectedValue(new ApiError(409, "DELIVERY_MODE_LOCKED", "x"));
    const toastError = vi.spyOn(toast, "error");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Đổi hình thức giao" }));
    await user.click(await screen.findByRole("button", { name: "Đổi hình thức" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toastError).toHaveBeenCalledWith(
      "Không đổi được hình thức giao",
      expect.stringMatching(/Không đổi được hình thức giao nữa/),
    );
    await waitFor(() =>
      expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === DETAIL_PATH)).toHaveLength(2),
    );
  });

  it("403 (mã quyền bị gỡ giữa chừng) → câu 'không có quyền đổi hình thức giao' ngay trong dialog", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinatorWithModes, () =>
      apiOrderDelivery("PICKING", OPEN_PARCEL),
    );
    vi.spyOn(api, "put").mockRejectedValue(new ApiError(403, "FORBIDDEN", "x"));
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Đổi hình thức giao" }));
    await user.click(await screen.findByRole("button", { name: "Đổi hình thức" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/không có quyền đổi hình thức giao/);
  });
});

describe("OrderDetail — lịch sử có DELIVERY_MODE_CHANGE", () => {
  const HISTORY = [
    {
      type: "STATUS_CHANGE",
      from: null,
      to: "PENDING_PAYMENT",
      occurredAt: "2026-10-20T01:00:00Z",
    },
    {
      type: "DELIVERY_MODE_CHANGE",
      from: null,
      to: null,
      reason: "Khách lấy 2 container, giao nguyên chuyến",
      occurredAt: "2026-10-22T04:00:00Z",
      actorName: "Điều phối A",
      deliveryMode: "FULL_TRUCKLOAD",
      previousDeliveryMode: "PARCEL",
    },
    {
      type: "DELIVERY_MODE_CHANGE",
      from: null,
      to: null,
      occurredAt: "2026-10-22T05:00:00Z",
      actorName: "Điều phối A",
      deliveryMode: "PARCEL",
    },
  ];

  it("render riêng 'Đổi hình thức giao: Giao lẻ → Nguyên xe (FTL)', ai, khi nào, ghi chú; mục chọn lúc release không có 'từ'", async () => {
    await renderDetail(
      ORDER_PERMISSION_SETS.readOnly,
      () => apiOrderDelivery("PICKING", OPEN_PARCEL),
      () => HISTORY,
    );
    const history = await screen.findByRole("region", { name: "Lịch sử đơn" });
    const items = await within(history).findAllByRole("listitem");
    expect(items.map((item) => item.getAttribute("data-kind"))).toEqual([
      "status-change",
      "delivery-mode",
      "delivery-mode",
    ]);
    const changed = items[1] as HTMLElement;
    expect(
      within(changed).getByText("Đổi hình thức giao: Giao lẻ → Nguyên xe (FTL)"),
    ).toBeInTheDocument();
    expect(within(changed).getByText(/Bởi Điều phối A/)).toBeInTheDocument();
    expect(
      within(changed).getByText("Khách lấy 2 container, giao nguyên chuyến"),
    ).toBeInTheDocument();
    const chosen = items[2] as HTMLElement;
    expect(within(chosen).getByText("Chọn hình thức giao: Giao lẻ")).toBeInTheDocument();
    expect(within(chosen).queryByText(/Ghi chú/)).not.toBeInTheDocument();
  });
});
