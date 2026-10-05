import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { apiOrder } from "../__fixtures__/order";
import { ORDER_PERMISSION_SETS, mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { OrderDetail } from "./OrderDetail";

import type { PermissionCode } from "@/lib/auth";
import type { OrderDto } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const DETAIL_PATH = `/orders/${apiOrder.orderId}`;
const CANCEL_PATH = `${DETAIL_PATH}/admin-cancellation`;

async function renderDetail(permissions: readonly PermissionCode[], handler: () => unknown) {
  mockOrderApiGet(permissions, { [DETAIL_PATH]: handler });
  // `use(params)` treo Suspense tới khi promise resolve — phải resolve trong act() thì React mới
  // render lại trong môi trường test.
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
}

const withStatus = (status: OrderDto["status"]): OrderDto => ({ ...apiOrder, status });

afterEach(() => vi.restoreAllMocks());

describe("OrderDetail — action-gating theo mã quyền + trạng thái BE", () => {
  it("ORDER_COORDINATOR (sales-orders:APPROVE) + PENDING_PAYMENT → có nút Huỷ đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => apiOrder);

    expect(await screen.findByRole("heading", { name: apiOrder.orderNumber })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Huỷ đơn" })).toBeInTheDocument();
  });

  it("SALES_STAFF (không có APPROVE) → không có nút Huỷ đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiOrder);

    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/identity/me/permissions", expect.anything()),
    );
    expect(screen.queryByRole("button", { name: "Huỷ đơn" })).not.toBeInTheDocument();
  });

  it("BE BR-031: có APPROVE nhưng đơn SHIPPED → không có nút Huỷ đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => withStatus("SHIPPED"));

    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/identity/me/permissions", expect.anything()),
    );
    expect(screen.queryByRole("button", { name: "Huỷ đơn" })).not.toBeInTheDocument();
  });

  it("hiện nhãn trạng thái tiếng Việt từ mã BE (IN_FULFILMENT → Đang xử lý kho)", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => withStatus("IN_FULFILMENT"));

    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.getByText("Đang xử lý kho")).toBeInTheDocument();
    expect(screen.queryByText("IN_FULFILMENT")).not.toBeInTheDocument();
  });

  it("đơn không tồn tại (404) → màn Không tìm thấy đơn hàng", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => {
      throw new ApiError(404, "NOT_FOUND", "Resource not found");
    });

    expect(
      await screen.findByRole("heading", { name: "Không tìm thấy đơn hàng" }),
    ).toBeInTheDocument();
  });
});

describe("OrderDetail — card thao tác giải thích khi không có nút", () => {
  it("SALES_STAFF → 'Bạn chỉ có quyền xem đơn hàng.'", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiOrder);
    expect(await screen.findByText("Bạn chỉ có quyền xem đơn hàng.")).toBeInTheDocument();
  });

  it("có APPROVE nhưng SHIPPED → hướng dẫn đi luồng trả hàng (BR-031)", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => withStatus("SHIPPED"));
    expect(
      await screen.findByText("Đơn đã bàn giao vận chuyển — chỉ xử lý qua luồng trả hàng."),
    ).toBeInTheDocument();
  });

  it("đơn CANCELLED (terminal) → 'Đơn đã kết thúc — không còn thao tác.'", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => withStatus("CANCELLED"));
    expect(await screen.findByText("Đơn đã kết thúc — không còn thao tác.")).toBeInTheDocument();
  });
});

describe("OrderDetail — luồng huỷ đơn", () => {
  it("nhập lý do + Ctrl+Enter → POST admin-cancellation với lý do đã trim, đóng dialog", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => apiOrder);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });

    await userEvent.click(await screen.findByRole("button", { name: "Huỷ đơn" }));
    await userEvent.type(
      screen.getByLabelText(/Lý do huỷ/),
      "  Khách đổi ý  {Control>}{Enter}{/Control}",
    );

    await waitFor(() => expect(post).toHaveBeenCalledWith(CANCEL_PATH, { reason: "Khách đổi ý" }));
    await waitFor(() => expect(screen.queryByLabelText(/Lý do huỷ/)).not.toBeInTheDocument());
  });

  it("lỗi mạng → dialog vẫn mở, giữ nguyên lý do để thử lại", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => apiOrder);
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(0, "NETWORK_ERROR", "Không kết nối được máy chủ."),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Huỷ đơn" }));
    await userEvent.type(
      screen.getByLabelText(/Lý do huỷ/),
      "Khách đổi ý{Control>}{Enter}{/Control}",
    );

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(screen.getByLabelText(/Lý do huỷ/)).toHaveValue("Khách đổi ý");
  });

  it("CONFLICT (đơn đã đổi trạng thái) → đóng dialog và tải lại đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => apiOrder);
    vi.spyOn(api, "post").mockRejectedValue(new ApiError(409, "CONFLICT", "Conflicting state"));

    await userEvent.click(await screen.findByRole("button", { name: "Huỷ đơn" }));
    await userEvent.type(
      screen.getByLabelText(/Lý do huỷ/),
      "Khách đổi ý{Control>}{Enter}{/Control}",
    );

    await waitFor(() => expect(screen.queryByLabelText(/Lý do huỷ/)).not.toBeInTheDocument());
    // Lần 1 lúc mở trang, lần 2 do invalidate orderKeys.all sau CONFLICT
    await waitFor(() =>
      expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === DETAIL_PATH)).toHaveLength(2),
    );
  });
});
