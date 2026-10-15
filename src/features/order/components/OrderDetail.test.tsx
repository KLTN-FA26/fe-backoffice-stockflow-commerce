import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useBreadcrumbLabelStore } from "@/lib/store/use-breadcrumb-labels";
import { toast } from "@/components/shared/Toast";

import { apiGuestOrder, apiOrder } from "../__fixtures__/order";
import {
  ORDER_PERMISSION_SETS,
  mockOrderApiGet,
  pickOrderSelectOption,
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

/** Mọi thao tác ghi đơn gửi kèm Idempotency-Key (header riêng request, không vào body). */
const WITH_IDEMPOTENCY_KEY = expect.objectContaining({
  headers: { "Idempotency-Key": expect.any(String) },
});

afterEach(() => vi.restoreAllMocks());

const DIALOG_FLOW_TIMEOUT_MS = 15_000;

describe("OrderDetail — action-gating theo mã quyền + trạng thái BE", () => {
  it("ORDER_COORDINATOR (sales-order-cancellations:UPDATE) + PENDING_PAYMENT → có nút Huỷ đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => apiOrder);

    expect(await screen.findByRole("heading", { name: apiOrder.orderNumber })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Huỷ đơn" })).toBeInTheDocument();
  });

  it("SALES_STAFF (sales-order-cancellations:UPDATE, BE V20261013000200) → có nút Huỷ đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiOrder);
    expect(await screen.findByRole("button", { name: "Huỷ đơn" })).toBeInTheDocument();
  });

  it("chỉ có quyền đọc (không có sales-order-cancellations:UPDATE) → không có nút Huỷ đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () => apiOrder);

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

  it("breadcrumb dùng mã đơn (SO-…) thay vì orderId UUID", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiOrder);

    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(useBreadcrumbLabelStore.getState().labels[apiOrder.orderId]).toBe(apiOrder.orderNumber);
  });

  it("hiện nhãn trạng thái tiếng Việt từ mã BE (IN_FULFILMENT → Đang xử lý kho)", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => withStatus("IN_FULFILMENT"));

    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.getByText("Đang xử lý kho")).toBeInTheDocument();
    expect(screen.queryByText("IN_FULFILMENT")).not.toBeInTheDocument();
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
  it("chỉ quyền đọc → 'Bạn chỉ có quyền xem đơn hàng.'", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () => apiOrder);
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

type User = ReturnType<typeof userEvent.setup>;

/** Mở dialog huỷ, chọn mã lý do (+ ghi chú) rồi bấm Huỷ đơn trong dialog. */
async function cancelWith(user: User, reason: RegExp | string, note = "") {
  await user.click(await screen.findByRole("button", { name: "Huỷ đơn" }));
  await pickOrderSelectOption(user, /Lý do huỷ/, reason);
  const dialog = screen.getByRole("dialog");
  if (note) {
    // paste thay vì gõ từng phím — nhanh, không phụ thuộc tải máy khi chạy cả bộ test
    await user.click(within(dialog).getByLabelText(/Ghi chú/));
    await user.paste(note);
  }
  await user.click(within(dialog).getByRole("button", { name: "Huỷ đơn" }));
  return dialog;
}

// Dialog nhiều bước (Radix Select trong jsdom) chậm khi chạy song song cả bộ test → nới timeout
describe(
  "OrderDetail — luồng huỷ đơn (reasonCode / note / retainedPercent)",
  { timeout: DIALOG_FLOW_TIMEOUT_MS },
  () => {
    it("chọn mã lý do + ghi chú → POST admin-cancellation {reasonCode, note đã trim}, đóng dialog", async () => {
      const user = userEvent.setup();
      await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => apiOrder);
      // BE trả OrderResponse đã CANCELLED
      const post = vi.spyOn(api, "post").mockResolvedValue({ data: withStatus("CANCELLED") });

      await cancelWith(user, "Khách yêu cầu", "  Khách đổi ý  ");

      await waitFor(() =>
        expect(post).toHaveBeenCalledWith(
          CANCEL_PATH,
          {
            reasonCode: "CUSTOMER_REQUEST",
            note: "Khách đổi ý",
          },
          WITH_IDEMPOTENCY_KEY,
        ),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("chưa chọn lý do → nút Huỷ đơn trong dialog bị khoá; 'Lý do khác' bắt buộc ghi chú", async () => {
      const user = userEvent.setup();
      await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => apiOrder);

      await user.click(await screen.findByRole("button", { name: "Huỷ đơn" }));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByRole("button", { name: "Huỷ đơn" })).toBeDisabled();
      await pickOrderSelectOption(user, /Lý do huỷ/, "Lý do khác");
      expect(within(dialog).getByText("Lý do khác cần ghi chú")).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Huỷ đơn" })).toBeDisabled();
    });

    it("đơn đã thu tiền → nhập % giữ lại thập phân, gửi retainedPercent", async () => {
      const user = userEvent.setup();
      await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => ({
        ...withStatus("IN_PRODUCTION"),
        paidAmount: 200_000,
      }));
      const post = vi.spyOn(api, "post").mockResolvedValue({ data: withStatus("CANCELLED") });

      await user.click(await screen.findByRole("button", { name: "Huỷ đơn" }));
      const dialog = screen.getByRole("dialog");
      // docs 19 BR-10: huỷ khi đang sản xuất có thể tính phí
      expect(within(dialog).getByText(/tính phí sản xuất/)).toBeInTheDocument();
      await pickOrderSelectOption(user, /Lý do huỷ/, "Khách yêu cầu");
      const retained = within(dialog).getByLabelText(/Giữ lại/);
      // BE nhận BigDecimal → 25.5% hợp lệ; validation gốc của trình duyệt (step) không được chặn submit
      await user.type(retained, "25.5");
      expect(retained).toBeValid();
      await user.click(within(dialog).getByRole("button", { name: "Huỷ đơn" }));

      await waitFor(() =>
        expect(post).toHaveBeenCalledWith(
          CANCEL_PATH,
          {
            reasonCode: "CUSTOMER_REQUEST",
            retainedPercent: 25.5,
          },
          WITH_IDEMPOTENCY_KEY,
        ),
      );
    });

    it("lỗi mạng → dialog vẫn mở, báo lỗi trong dialog để thử lại", async () => {
      const user = userEvent.setup();
      await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => apiOrder);
      vi.spyOn(api, "post").mockRejectedValue(
        new ApiError(0, "NETWORK_ERROR", "Không kết nối được máy chủ."),
      );

      const dialog = await cancelWith(user, "Khách yêu cầu");

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Không kết nối được máy chủ",
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("lỗi có traceId → tiêu đề 'Không huỷ được đơn' + nhãn chung 'TraceId' trong dialog", async () => {
      const user = userEvent.setup();
      await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => apiOrder);
      vi.spyOn(api, "post").mockRejectedValue(
        new ApiError(500, "INTERNAL_ERROR", "boom", undefined, "corr-77"),
      );

      const dialog = await cancelWith(user, "Khách yêu cầu");

      const alert = await within(dialog).findByRole("alert");
      expect(alert).toHaveTextContent(UI_LABELS.order.cancelFailedTitle);
      expect(alert).toHaveTextContent(`${UI_LABELS.common.traceId}: corr-77`);
    });

    it("ORDER_NOT_CANCELLABLE (đơn đã đổi trạng thái) → đóng dialog, toast và tải lại đơn", async () => {
      const user = userEvent.setup();
      await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => apiOrder);
      const toastError = vi.spyOn(toast, "error");
      vi.spyOn(api, "post").mockRejectedValue(
        new ApiError(409, "ORDER_NOT_CANCELLABLE", "Conflicting state"),
      );

      await cancelWith(user, "Khách yêu cầu");

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(toastError).toHaveBeenCalledWith("Đơn không còn huỷ được", expect.any(String));
      // Lần 1 lúc mở trang, lần 2 do invalidate orderKeys.all
      await waitFor(() =>
        expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === DETAIL_PATH)).toHaveLength(
          2,
        ),
      );
    });
  },
);

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
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => {
      throw new ApiError(403, "FORBIDDEN", "Not authorised");
    });

    await screen.findByRole("heading", { name: UI_LABELS.loadError.forbiddenTitle });
    expect(screen.getAllByText(UI_LABELS.order.forbiddenDescription)).toHaveLength(1);
  });
});

describe(
  "OrderDetail — huỷ đơn: fieldErrors BE → ô form (Step 8)",
  { timeout: DIALOG_FLOW_TIMEOUT_MS },
  () => {
    it("B. nhiều field (reasonCode + note) → lỗi tại cả hai ô, kể cả ghi chú khi lý do không phải 'khác'", async () => {
      const user = userEvent.setup();
      await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => apiOrder);
      vi.spyOn(api, "post").mockRejectedValue(
        new ApiError(400, "VALIDATION_FAILED", "Invalid request data", {
          reasonCode: "must not be null",
          note: "note is at most 1000 characters",
        }),
      );

      const dialog = await cancelWith(user, "Khách yêu cầu", "Ghi chú");
      expect(await within(dialog).findByText("Chọn lý do huỷ hợp lệ.")).toBeInTheDocument();
      expect(within(dialog).getByText(/Ghi chú tối đa 1000 ký tự/)).toBeInTheDocument();
      expect(within(dialog).getByLabelText(/Ghi chú/)).toHaveAttribute("aria-invalid", "true");
    });

    it("C. field lạ (`reason` cũ) → không crash, message máy chủ đi vào thông báo chung", async () => {
      const user = userEvent.setup();
      await renderDetail(ORDER_PERMISSION_SETS.coordinator, () => apiOrder);
      vi.spyOn(api, "post").mockRejectedValue(
        new ApiError(400, "VALIDATION_FAILED", "Invalid request data", {
          reason: "reason is at most 500 characters",
        }),
      );

      const dialog = await cancelWith(user, "Khách yêu cầu");
      const alert = await within(dialog).findByRole("alert");
      expect(alert).toHaveTextContent("Kiểm tra lại lý do huỷ");
      expect(alert).toHaveTextContent("reason is at most 500 characters");
    });
  },
);
