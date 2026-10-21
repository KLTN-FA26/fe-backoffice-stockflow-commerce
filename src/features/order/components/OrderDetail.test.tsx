import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useBreadcrumbLabelStore } from "@/lib/store/use-breadcrumb-labels";
import { toast } from "@/components/shared/Toast";

import { apiGuestOrder, apiOrder, apiOrderWith, apiPartialOrder } from "../__fixtures__/order";
import {
  ORDER_PERMISSION_SETS,
  mockOrderApiGet,
  pickSelectOption,
  renderOrderScreen,
} from "../__fixtures__/render";

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
  it("ORDER_COORDINATOR (sales-order-cancellations:UPDATE) + PENDING_PAYMENT → có nút Huỷ đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => apiOrder);

    expect(await screen.findByRole("heading", { name: apiOrder.orderNumber })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Huỷ đơn" })).toBeInTheDocument();
  });

  it("tài khoản chỉ đọc (không có quyền huỷ) → không có nút Huỷ đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () => apiOrder);

    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/identity/me/permissions", expect.anything()),
    );
    expect(screen.queryByRole("button", { name: "Huỷ đơn" })).not.toBeInTheDocument();
  });

  it("BR-ORD-004: có quyền huỷ nhưng đơn SHIPPED → không có nút Huỷ đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => withStatus("SHIPPED"));

    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/identity/me/permissions", expect.anything()),
    );
    expect(screen.queryByRole("button", { name: "Huỷ đơn" })).not.toBeInTheDocument();
  });

  it("breadcrumb dùng mã đơn (SO-…) thay vì orderId UUID", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () => apiOrder);

    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(useBreadcrumbLabelStore.getState().labels[apiOrder.orderId]).toBe(apiOrder.orderNumber);
  });

  it("hiện nhãn trạng thái tiếng Việt từ mã BE (PICKING → Đang lấy hàng)", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () => withStatus("PICKING"));

    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.getByText("Đang lấy hàng")).toBeInTheDocument();
    expect(screen.queryByText("PICKING")).not.toBeInTheDocument();
  });

  it("mã trạng thái lạ → 'Không rõ', không hỏng trang, không có thao tác", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => withStatus("REVIEWING" as never));

    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.getByText("Không rõ")).toBeInTheDocument();
    expect(
      screen.getByText("Trạng thái đơn chưa được hỗ trợ — không có thao tác."),
    ).toBeInTheDocument();
  });

  it("đơn guest (JSON thật, không có key customerId) → mở được chi tiết", async () => {
    mockOrderApiGet(ORDER_PERMISSION_SETS.coordinator, {
      [`/orders/${apiGuestOrder.orderId}`]: () => apiGuestOrder,
    });
    await act(async () => {
      renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiGuestOrder.orderId })} />);
    });

    expect(
      await screen.findByRole("heading", { name: apiGuestOrder.orderNumber }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Không tìm thấy đơn hàng")).not.toBeInTheDocument();
  });

  it("response sai hợp đồng → 'Dữ liệu trả về không đúng định dạng', không retry", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => ({ orderId: "x" }));

    expect(
      await screen.findByRole("heading", { name: "Dữ liệu trả về không đúng định dạng" }),
    ).toBeInTheDocument();
    expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === DETAIL_PATH)).toHaveLength(1);
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
  it("tài khoản chỉ đọc → 'Bạn chỉ có quyền xem đơn hàng.'", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () => apiOrder);
    expect(await screen.findByText("Bạn chỉ có quyền xem đơn hàng.")).toBeInTheDocument();
  });

  it("đơn PACKED → hướng dẫn đi luồng trả hàng (BR-ORD-004)", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () => withStatus("PACKED"));
    expect(
      await screen.findByText(
        "Đơn đã đóng gói / bàn giao vận chuyển — chỉ xử lý qua luồng trả hàng.",
      ),
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

  it("lỗi có traceId → toast dùng nhãn chung 'TraceId', tiêu đề 'Không huỷ được đơn'", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => apiOrder);
    const toastError = vi.spyOn(toast, "error");
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(500, "INTERNAL_ERROR", "boom", undefined, "corr-77"),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Huỷ đơn" }));
    await userEvent.type(
      screen.getByLabelText(/Lý do huỷ/),
      "Khách đổi ý{Control>}{Enter}{/Control}",
    );

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const [title, detail] = toastError.mock.calls[0] ?? [];
    expect(title).toBe(UI_LABELS.order.cancelFailedTitle);
    expect(detail).toContain(`${UI_LABELS.common.traceId}: corr-77`);
  });

  it("ORDER_INVALID_TRANSITION (đơn đã đổi trạng thái) → đóng dialog và tải lại đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => apiOrder);
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(409, "ORDER_INVALID_TRANSITION", "This order cannot move to that status now"),
    );

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

describe("OrderDetail — kiểm quyền trước khi gọi API", () => {
  it("WAREHOUSE_STAFF (không có sales-orders) → 'Bạn không có quyền', không gọi GET /orders/{id}", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.none, () => apiOrder);

    expect(await screen.findByText("Bạn không có quyền")).toBeInTheDocument();
    expect(vi.mocked(api.get).mock.calls.some(([url]) => url === DETAIL_PATH)).toBe(false);
  });

  it("chỉ VIEW_PAGE (thiếu READ) → không gọi GET /orders/{id}", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.viewOnly, () => apiOrder);

    expect(
      await screen.findByRole("heading", { name: UI_LABELS.loadError.noReadTitle }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
    expect(vi.mocked(api.get).mock.calls.some(([url]) => url === DETAIL_PATH)).toBe(false);
  });

  it("BE trả 403 → câu giải thích chỉ hiện 1 lần (không lặp header + thân)", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () => {
      throw new ApiError(403, "FORBIDDEN", "Not authorised");
    });

    await screen.findByRole("heading", { name: UI_LABELS.loadError.forbiddenTitle });
    expect(screen.getAllByText(UI_LABELS.order.forbiddenDescription)).toHaveLength(1);
  });
});

describe("OrderDetail — hiển thị vòng đời (BE PR #133)", () => {
  it("đơn ON_HOLD: lý do, ghi chú (staff) và bước sẽ quay về", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () =>
      apiOrderWith({
        status: "ON_HOLD",
        holdReason: "ADDRESS",
        holdNote: "Sai phường — chờ khách",
        statusBeforeHold: "PICKING",
      }),
    );

    expect(await screen.findByText("Đơn đang tạm giữ")).toBeInTheDocument();
    expect(screen.getByText("Sai địa chỉ / hãng vận chuyển không giao tới")).toBeInTheDocument();
    expect(screen.getByText("Sai phường — chờ khách")).toBeInTheDocument();
    expect(screen.getByText("Đang lấy hàng")).toBeInTheDocument();
  });

  it("mốc thời gian, tiền (billed / effective / amountDue) và giao thất bại", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () =>
      apiOrderWith({
        status: "DELIVERY_FAILED",
        packedAt: "2026-09-08T01:00:00Z",
        shippedAt: "2026-09-08T02:00:00Z",
        deliveryFailureReason: "CUSTOMER_ABSENT",
        billedAmount: 100000,
        effectiveTotal: 250000,
        amountDue: 150000,
        amountDueBeforeHandover: 0,
      }),
    );

    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.getByText("Đóng gói xong")).toBeInTheDocument();
    expect(screen.getByText("Bàn giao vận chuyển")).toBeInTheDocument();
    expect(screen.getByText("Khách vắng mặt")).toBeInTheDocument();
    expect(screen.getByText("Đã ghi công nợ")).toBeInTheDocument();
    expect(screen.getByText("Giá trị sau khi đóng phần còn lại")).toBeInTheDocument();
    expect(screen.getByText("Khách còn nợ")).toBeInTheDocument();
    // = 0 → không có hàng nào bị chặn bàn giao vì tiền
    expect(screen.queryByText("Phải trả trước khi xuất hàng")).not.toBeInTheDocument();
  });

  it("danh sách lô giao với trạng thái từng lô và số lượng giao từng dòng", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () => apiPartialOrder);

    expect(await screen.findByRole("region", { name: "Lô giao" })).toBeInTheDocument();
    expect(screen.getByText("Lô 1")).toBeInTheDocument();
    expect(screen.getByText("Đã bàn giao")).toBeInTheDocument();
    expect(screen.getByText("Đã bàn giao:")).toBeInTheDocument();
    expect(screen.getByText("Đã giao:")).toBeInTheDocument();
    expect(screen.getByText("Giao một phần")).toBeInTheDocument();
  });
});

describe("OrderDetail — Giữ đơn", () => {
  it("chỉ ORDER_COORDINATOR (APPROVE) thấy 'Giữ đơn' ở đơn đang lấy hàng", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => withStatus("PICKING"));
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.queryByRole("button", { name: "Giữ đơn" })).not.toBeInTheDocument();
  });

  it("chọn lý do + ghi chú → POST /hold {reasonCode, note}, đóng dialog", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => withStatus("PICKING"));
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Giữ đơn" }));
    await pickSelectOption(user, /Lý do giữ/, "Sai địa chỉ / hãng vận chuyển không giao tới");
    await user.type(screen.getByLabelText(/Ghi chú/), "  Sai phường  ");
    await user.click(screen.getByRole("button", { name: "Giữ đơn", hidden: false }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${DETAIL_PATH}/hold`, {
        reasonCode: "ADDRESS",
        note: "Sai phường",
      }),
    );
  });

  it("'Lý do khác' bắt buộc ghi chú — chặn trước khi gọi API", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => withStatus("PICKING"));
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Giữ đơn" }));
    await pickSelectOption(user, /Lý do giữ/, "Lý do khác");
    await user.click(screen.getAllByRole("button", { name: "Giữ đơn" }).at(-1) as HTMLElement);

    expect(
      await screen.findByText("Ghi chú là bắt buộc khi chọn “Lý do khác”"),
    ).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("không chọn lý do → 'Chọn lý do', không gọi API; danh sách không có CREDIT / DESIGN_MISMATCH", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => withStatus("PICKING"));
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Giữ đơn" }));
    await user.click(screen.getAllByRole("button", { name: "Giữ đơn" }).at(-1) as HTMLElement);
    expect(await screen.findByRole("alert")).toHaveTextContent("Chọn lý do");
    expect(post).not.toHaveBeenCalled();

    await pickSelectOption(user, /Lý do giữ/, "Vấn đề thanh toán");
    expect(screen.queryByRole("option", { name: "Vượt hạn mức công nợ" })).not.toBeInTheDocument();
  });

  it("ORDER_INVALID_TRANSITION → toast tiếng Việt, đóng dialog, tải lại đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => withStatus("PICKING"));
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(409, "ORDER_INVALID_TRANSITION", "English"),
    );
    const toastError = vi.spyOn(toast, "error");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Giữ đơn" }));
    await pickSelectOption(user, /Lý do giữ/, "Vấn đề thanh toán");
    await user.click(screen.getAllByRole("button", { name: "Giữ đơn" }).at(-1) as HTMLElement);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]?.[0]).toBe("Không giữ được đơn");
    expect(String(toastError.mock.calls[0]?.[1])).toContain("không thể chuyển sang trạng thái này");
    await waitFor(() =>
      expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === DETAIL_PATH)).toHaveLength(2),
    );
  });
});

describe("OrderDetail — Gỡ giữ", () => {
  const held = (holdReason: string) =>
    apiOrderWith({ status: "ON_HOLD", holdReason, statusBeforeHold: "PICKING" });

  it("giữ do điều phối viên → Gỡ giữ cần ghi chú, POST /hold/resolution {note}", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => held("CUSTOMER"));
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Gỡ giữ" }));
    // Bắt buộc ghi chú: gửi trống bị chặn
    await user.click(screen.getAllByRole("button", { name: "Gỡ giữ" }).at(-1) as HTMLElement);
    expect(await screen.findByText("Hãy ghi cách đã xử lý")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Cách đã xử lý/), "Khách xác nhận");
    await user.click(screen.getAllByRole("button", { name: "Gỡ giữ" }).at(-1) as HTMLElement);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${DETAIL_PATH}/hold/resolution`, {
        note: "Khách xác nhận",
      }),
    );
  });

  it("giữ do CREDIT → không có nút Gỡ giữ, hướng dẫn duyệt ở màn công nợ", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => held("CREDIT"));

    expect(await screen.findByText(/Duyệt hoặc từ chối ở màn duyệt công nợ/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gỡ giữ" })).not.toBeInTheDocument();
    // Vẫn huỷ được (ON_HOLD → CANCELLED)
    expect(screen.getByRole("button", { name: "Huỷ đơn" })).toBeInTheDocument();
  });

  it("giữ do DESIGN_MISMATCH → không có nút Gỡ giữ, hướng dẫn kiểm tra lại kiện ở bàn đóng gói", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => held("DESIGN_MISMATCH"));

    expect(await screen.findByText(/kiểm tra lại kiện ở bàn đóng gói/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gỡ giữ" })).not.toBeInTheDocument();
  });

  it("ORDER_NOT_ON_HOLD → câu tiếng Việt", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => held("FRAUD"));
    vi.spyOn(api, "post").mockRejectedValue(new ApiError(409, "ORDER_NOT_ON_HOLD", "English"));
    const toastError = vi.spyOn(toast, "error");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Gỡ giữ" }));
    await user.type(screen.getByLabelText(/Cách đã xử lý/), "ok");
    await user.click(screen.getAllByRole("button", { name: "Gỡ giữ" }).at(-1) as HTMLElement);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0]?.[1])).toContain("không ở trạng thái tạm giữ");
  });
});

describe("OrderDetail — Ghi giao thất bại", () => {
  it("đơn SHIPPED chưa chia lô → POST /delivery-failure {reasonCode, note}", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => withStatus("SHIPPED"));
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Ghi giao thất bại" }));
    await pickSelectOption(user, /Lý do giao thất bại/, "Khách vắng mặt");
    await user.click(
      screen.getAllByRole("button", { name: "Ghi giao thất bại" }).at(-1) as HTMLElement,
    );

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${DETAIL_PATH}/delivery-failure`, {
        reasonCode: "CUSTOMER_ABSENT",
      }),
    );
  });

  it("đơn đã chia lô → ẩn nút, giải thích kết quả giao ghi theo lô", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () =>
      apiOrderWith({ ...apiPartialOrder, status: "SHIPPED" }),
    );

    expect(await screen.findByText(/kết quả giao được ghi theo từng lô/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ghi giao thất bại" })).not.toBeInTheDocument();
  });

  it("ORDER_DELIVERY_VIA_SHIPMENT (BE từ chối) → câu tiếng Việt", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => withStatus("SHIPPED"));
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(409, "ORDER_DELIVERY_VIA_SHIPMENT", "English"),
    );
    const toastError = vi.spyOn(toast, "error");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Ghi giao thất bại" }));
    await pickSelectOption(user, /Lý do giao thất bại/, "Khách từ chối nhận");
    await user.click(
      screen.getAllByRole("button", { name: "Ghi giao thất bại" }).at(-1) as HTMLElement,
    );

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0]?.[1])).toContain("theo từng lô");
  });
});

describe("OrderDetail — Đóng phần còn lại", () => {
  it("đơn giao một phần + quyền huỷ → POST /remainder-closure; có cả Giữ đơn cho coordinator", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => apiPartialOrder);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });
    const user = userEvent.setup();

    expect(await screen.findByRole("button", { name: "Giữ đơn" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Đóng phần còn lại" }));
    await pickSelectOption(user, /Lý do đóng/, "Lý do khác");
    await user.type(screen.getByLabelText(/Ghi chú/), "Hết hàng cả kho");
    await user.click(
      screen.getAllByRole("button", { name: "Đóng phần còn lại" }).at(-1) as HTMLElement,
    );

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${DETAIL_PATH}/remainder-closure`, {
        reasonCode: "OTHER",
        note: "Hết hàng cả kho",
      }),
    );
  });

  it("SALES_STAFF (cancellations:UPDATE) đóng được nhưng không có Giữ đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiPartialOrder);

    expect(await screen.findByRole("button", { name: "Đóng phần còn lại" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Giữ đơn" })).not.toBeInTheDocument();
  });

  it("chỉ đọc → không có nút; đơn không phải PARTIALLY_FULFILLED → không có nút", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () => apiPartialOrder);
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.queryByRole("button", { name: "Đóng phần còn lại" })).not.toBeInTheDocument();
  });
});

describe("OrderDetail — số liệu BE luôn gửi (0 khi chưa có lô / chưa ghi công nợ)", () => {
  it("đơn chưa có lô giao và chưa đóng bớt: không hiện dòng tiến độ giao (BE gửi 0 / 0 / 0)", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () => withStatus("CONFIRMED"));

    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.queryByText(/Đã bàn giao:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Đang giao:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Đã giao:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Không giao/)).not.toBeInTheDocument();
  });

  it("đơn đã đóng bớt đơn vị nhưng chưa có lô: chỉ hiện 'Không giao (đã đóng)'", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () =>
      apiOrderWith({
        lines: [{ ...apiOrder.lines[0], cancelledQuantity: 1 }],
      }),
    );

    expect(await screen.findByText(/Không giao \(đã đóng\):/)).toBeInTheDocument();
    expect(screen.queryByText(/Đã bàn giao:/)).not.toBeInTheDocument();
  });

  it("billedAmount = 0 ẩn với đơn trả trước; hiện với đơn CREDIT (kể cả 0) hoặc khi > 0", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () => apiOrder);
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.queryByText("Đã ghi công nợ")).not.toBeInTheDocument();
    expect(screen.getByText("Khách còn nợ")).toBeInTheDocument();
  });

  it("đơn CREDIT: hiện 'Đã ghi công nợ' dù = 0", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () =>
      apiOrderWith({ paymentTerm: "CREDIT" }),
    );
    expect(await screen.findByText("Đã ghi công nợ")).toBeInTheDocument();
  });

  it("billedAmount > 0 hiện dù đơn không phải CREDIT", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () =>
      apiOrderWith({ billedAmount: 120000 }),
    );
    expect(await screen.findByText("Đã ghi công nợ")).toBeInTheDocument();
  });

  it.each(["DRAFT", "CANCELLED", "CLOSED"] as const)(
    "%s: ẩn 'Khách còn nợ' và 'Phải trả trước khi xuất hàng' dù BE tính từ tổng đơn",
    async (status) => {
      await renderDetail(ORDER_PERMISSION_SETS.readOnly, () => withStatus(status));

      await screen.findByRole("heading", { name: apiOrder.orderNumber });
      expect(screen.queryByText("Khách còn nợ")).not.toBeInTheDocument();
      expect(screen.queryByText("Phải trả trước khi xuất hàng")).not.toBeInTheDocument();
    },
  );

  it("đơn trả trước còn nợ trước khi xuất kho: hiện cả hai dòng", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () => withStatus("PACKED"));
    expect(await screen.findByText("Khách còn nợ")).toBeInTheDocument();
    expect(screen.getByText("Phải trả trước khi xuất hàng")).toBeInTheDocument();
  });
});

describe("OrderDetail — huỷ khi đã đóng gói (BE Order#requireNotPacked)", () => {
  it("đơn ON_HOLD giữ từ PACKED (có packedAt) → không có nút Huỷ đơn, vẫn gỡ giữ được", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () =>
      apiOrderWith({
        status: "ON_HOLD",
        holdReason: "FRAUD",
        statusBeforeHold: "PACKED",
        packedAt: "2026-09-08T01:00:00Z",
      }),
    );

    expect(await screen.findByRole("button", { name: "Gỡ giữ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Huỷ đơn" })).not.toBeInTheDocument();
  });

  it("đơn ON_HOLD giữ từ PICKING (chưa packedAt) → vẫn huỷ được", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () =>
      apiOrderWith({ status: "ON_HOLD", holdReason: "FRAUD", statusBeforeHold: "PICKING" }),
    );
    expect(await screen.findByRole("button", { name: "Huỷ đơn" })).toBeInTheDocument();
  });
});

describe("OrderDetail — giữ đơn không rõ lý do", () => {
  it.each(["NEW_REASON_FROM_BE", undefined])(
    "holdReason %s → không có Gỡ giữ, hiện hướng dẫn 'chưa thể gỡ giữ'",
    async (holdReason) => {
      await renderDetail(ORDER_PERMISSION_SETS.coordinator, () =>
        apiOrderWith({ status: "ON_HOLD", holdReason, statusBeforeHold: "PICKING" }),
      );

      expect(
        await screen.findByText(/Không xác định được lý do giữ — chưa thể gỡ giữ/),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Gỡ giữ" })).not.toBeInTheDocument();
    },
  );

  it("tài khoản chỉ đọc không bị nhắc 'chưa thể gỡ giữ'", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () =>
      apiOrderWith({ status: "ON_HOLD", holdReason: "NEW_REASON_FROM_BE" }),
    );
    await screen.findByText("Đơn đang tạm giữ");
    expect(screen.queryByText(/chưa thể gỡ giữ/)).not.toBeInTheDocument();
  });
});
