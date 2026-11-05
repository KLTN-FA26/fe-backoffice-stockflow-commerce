/**
 * Màn chi tiết đơn — Giao một phần do Sales quyết (BE PR #150).
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { apiOrder, apiOrderPartialShipment, apiPartialOrder } from "../__fixtures__/order";
import { DETAIL_PATH, renderDetail } from "../__fixtures__/detail";
import { ORDER_PERMISSION_SETS } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const PARTIAL_PATH = `${DETAIL_PATH}/partial-shipment`;

describe("OrderDetail — Giao một phần (sales-order-partial-shipments:UPDATE)", () => {
  it("SALES_STAFF + cờ tắt → hiện trạng thái, bấm 'Cho phép giao một phần' + ghi chú → PUT {allowed: true, note}", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () =>
      apiOrderPartialShipment("PICKING", { allowPartialShipment: false }),
    );
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: apiOrder });
    const toastSuccess = vi.spyOn(toast, "success");
    const user = userEvent.setup();

    expect(await screen.findByText(/Chưa cho phép/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cho phép giao một phần" }));
    await user.type(screen.getByLabelText(/Ghi chú/), "  Khách đồng ý nhận hàng sẵn trước  ");
    await user.click(screen.getByRole("button", { name: "Cho phép" }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(PARTIAL_PATH, {
        allowed: true,
        note: "Khách đồng ý nhận hàng sẵn trước",
      }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã cho phép giao một phần"));
    // Dialog đóng sau khi thành công; đơn được tải lại (cờ mới nằm ở response GET)
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === DETAIL_PATH)).toHaveLength(2),
    );
  });

  it("cờ đang bật → nút 'Dừng giao một phần'; không ghi chú thì body không có note", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () =>
      apiOrderPartialShipment("PICKING", { allowPartialShipment: true }),
    );
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: apiOrder });
    const user = userEvent.setup();

    expect(await screen.findByText("Đang cho phép")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dừng giao một phần" }));
    await user.click(screen.getByRole("button", { name: "Dừng giao một phần", hidden: false }));

    await waitFor(() => expect(put).toHaveBeenCalledWith(PARTIAL_PATH, { allowed: false }));
  });

  it.each([
    ["điều phối viên (không có mã sales-order-partial-shipments:UPDATE)", "coordinator"],
    ["tài khoản chỉ đọc", "readOnly"],
  ] as const)("gate theo mã quyền: %s thấy trạng thái nhưng không có nút", async (_name, set) => {
    await renderDetail(ORDER_PERMISSION_SETS[set], () =>
      apiOrderPartialShipment("PICKING", { allowPartialShipment: false }),
    );
    expect(await screen.findByText(/Chưa cho phép/)).toBeInTheDocument();
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/identity/me/permissions", expect.anything()),
    );
    expect(screen.queryByRole("button", { name: /giao một phần/i })).not.toBeInTheDocument();
  });

  it("ON_HOLD giữ từ PARTIALLY_FULFILLED mà hàng in chưa xong → không có nút Dừng (BE vẫn 409), giải thích đơn đã tách", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => ({
      ...apiPartialOrder,
      status: "ON_HOLD",
      holdReason: "FRAUD",
      statusBeforeHold: "PARTIALLY_FULFILLED",
      allowPartialShipment: true,
      printLinesReady: false,
    }));
    expect(await screen.findByText(/đơn đã tách/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dừng giao một phần" })).not.toBeInTheDocument();
  });

  it("đơn IN_PRODUCTION chưa giao lô nào → vẫn có nút Dừng giao một phần", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => ({
      ...apiOrderPartialShipment("IN_PRODUCTION", { allowPartialShipment: true }),
      printLinesReady: false,
    }));
    expect(await screen.findByRole("button", { name: "Dừng giao một phần" })).toBeInTheDocument();
  });

  it("BE không trả cờ → không hiện thẻ 'Giao một phần' (không đoán)", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiOrder);
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.queryByText("Giao một phần")).not.toBeInTheDocument();
  });

  it("đơn đã SHIPPED → khoá: không có nút, giải thích đơn đã đi / đóng", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () =>
      apiOrderPartialShipment("SHIPPED", { allowPartialShipment: true }),
    );
    expect(await screen.findByText(/không còn đổi được cách giao/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /giao một phần/i })).not.toBeInTheDocument();
  });

  it("đơn giao dở còn chờ hàng in → không cho dừng, giải thích đơn đã tách", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => ({
      ...apiPartialOrder,
      allowPartialShipment: true,
      printLinesReady: false,
    }));
    expect(await screen.findByText(/đơn đã tách/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dừng giao một phần" })).not.toBeInTheDocument();
  });

  it("409 ORDER_PARTIAL_SHIPMENT_LOCKED → toast tiếng Việt, đóng dialog, tải lại đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () =>
      apiOrderPartialShipment("PICKING", { allowPartialShipment: true }),
    );
    vi.spyOn(api, "put").mockRejectedValue(
      new ApiError(409, "ORDER_PARTIAL_SHIPMENT_LOCKED", "English"),
    );
    const toastError = vi.spyOn(toast, "error");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Dừng giao một phần" }));
    await user.click(screen.getByRole("button", { name: "Dừng giao một phần", hidden: false }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]?.[0]).toBe("Không cập nhật được giao một phần");
    expect(String(toastError.mock.calls[0]?.[1])).toContain("Không đổi được cách giao");
    await waitFor(() =>
      expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === DETAIL_PATH)).toHaveLength(2),
    );
  });

  it("lỗi mạng → dialog vẫn mở, lỗi hiện trong dialog", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () =>
      apiOrderPartialShipment("PICKING", { allowPartialShipment: false }),
    );
    vi.spyOn(api, "put").mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "x"));
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Cho phép giao một phần" }));
    await user.click(screen.getByRole("button", { name: "Cho phép" }));

    expect(await screen.findByText(/Không kết nối được máy chủ/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
