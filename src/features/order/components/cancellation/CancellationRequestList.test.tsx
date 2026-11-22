/**
 * Hàng đợi yêu cầu huỷ (`/admin/orders/cancellation-requests`, docs 17 §4.8 bước 28): gate bằng
 * `sales-order-cancellations:READ`, chỉ lấy yêu cầu đang chờ, nút quyết định theo `…:UPDATE`, trạng thái rỗng / lỗi.
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { CancellationRequestList } from "./CancellationRequestList";

import {
  REQUEST_ID,
  REQUESTS_PATH,
  WF4_PERMISSION_SETS,
  apiCancellationRequest,
  callsTo,
  requestPage,
} from "../../__fixtures__/wf4";
import { DETAIL_PATH } from "../../__fixtures__/detail";
import { apiOrder } from "../../__fixtures__/order";
import { mockOrderApiGet, renderOrderScreen } from "../../__fixtures__/render";

import type { PermissionCode } from "@/lib/auth";
import type { RouteHandler } from "../../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

async function renderQueue(
  permissions: readonly PermissionCode[],
  list: RouteHandler = () => requestPage([apiCancellationRequest()]),
) {
  const spy = mockOrderApiGet(permissions, {
    [REQUESTS_PATH]: list,
    [DETAIL_PATH]: () => apiOrder,
  });
  await act(async () => {
    renderOrderScreen(<CancellationRequestList />);
  });
  return spy;
}

describe("Hàng đợi yêu cầu huỷ — gate theo mã quyền BE", () => {
  it("Sale (…:READ + …:UPDATE): thấy hàng, mã đơn link tới thẻ yêu cầu huỷ của đơn, nút Duyệt huỷ + Từ chối", async () => {
    await renderQueue(WF4_PERMISSION_SETS.sales);
    const link = await screen.findByRole("link", { name: apiOrder.orderNumber });
    expect(link).toHaveAttribute("href", `/admin/orders/${apiOrder.orderId}#cancellation-request`);
    expect(screen.getByText("Khách yêu cầu")).toBeInTheDocument();
    expect(screen.getByText("Khách hoãn dự án")).toBeInTheDocument();
    // BO-UX-34: không còn cột "Trạng thái" (hàng đợi luôn PENDING)
    expect(screen.queryByRole("columnheader", { name: "Trạng thái" })).not.toBeInTheDocument();
    // BO-UX-36: nút mang số đơn; "Duyệt huỷ" tông nguy hiểm
    const approve = screen.getByRole("button", { name: `Duyệt huỷ — ${apiOrder.orderNumber}` });
    expect(approve.className).toContain("text-danger");
    expect(
      screen.getByRole("button", { name: `Từ chối — ${apiOrder.orderNumber}` }),
    ).toBeInTheDocument();
  });

  it("BO-UX-34: khách, tổng đơn, đã thu, trạng thái đơn đọc từ đơn khi BE chưa gửi R5-6; R5-6 có thì dùng luôn", async () => {
    const spy = await renderQueue(WF4_PERMISSION_SETS.sales, () =>
      requestPage([
        apiCancellationRequest({
          requestId: "r-r5",
          orderNumber: "SO-R5-0001",
          customerName: "Công ty In Ấn Sao Mai",
          orderTotal: 28_620_000,
          paidTotal: 8_586_000,
          orderStatus: "IN_PRODUCTION",
          printingStarted: true,
          note: "a".repeat(200),
        }),
      ]),
    );
    const row = (await screen.findByRole("link", { name: "SO-R5-0001" })).closest(
      "tr",
    ) as HTMLElement;
    expect(within(row).getByText("Công ty In Ấn Sao Mai")).toBeInTheDocument();
    expect(within(row).getByText(/28\.620\.000/)).toBeInTheDocument();
    expect(within(row).getByText(/8\.586\.000/)).toBeInTheDocument();
    expect(within(row).getByText("Đã in")).toBeInTheDocument();
    // Đủ R5-6 → không gọi chi tiết đơn
    expect(callsTo(spy, DETAIL_PATH)).toBe(0);
    // Ghi chú dài: nút "Xem thêm" mở hết (aria-expanded)
    const more = within(row).getByRole("button", { name: "Xem thêm" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    await userEvent.setup().click(more);
    expect(within(row).getByRole("button", { name: "Thu gọn" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("chỉ lấy yêu cầu đang chờ: status=PENDING, trang 0", async () => {
    const spy = await renderQueue(WF4_PERMISSION_SETS.sales);
    await screen.findByRole("link", { name: apiOrder.orderNumber });
    const params = (
      spy.mock.calls.find((c) => c[0] === REQUESTS_PATH)?.[1] as { params: URLSearchParams }
    ).params;
    expect(params.get("status")).toBe("PENDING");
    expect(params.get("page")).toBe("0");
  });

  it("chỉ đọc (không …:UPDATE) → thấy hàng nhưng không có nút quyết định", async () => {
    await renderQueue(WF4_PERMISSION_SETS.salesReadOnly);
    await screen.findByRole("link", { name: apiOrder.orderNumber });
    expect(screen.queryByRole("button", { name: /^Duyệt huỷ/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Từ chối/ })).not.toBeInTheDocument();
  });

  it("Kế toán / quản lý kho (không …:READ) → chặn trang, KHÔNG gọi API hàng đợi", async () => {
    for (const permissions of [
      WF4_PERMISSION_SETS.accountant,
      WF4_PERMISSION_SETS.warehouseManager,
    ]) {
      const spy = await renderQueue(permissions);
      expect(await screen.findByText("Bạn không có quyền")).toBeInTheDocument();
      expect(callsTo(spy, REQUESTS_PATH)).toBe(0);
      vi.restoreAllMocks();
      document.body.innerHTML = "";
    }
  });

  it("không có quyền đọc đơn (sales-orders:READ) → mã đơn không là link, không gọi chi tiết đơn", async () => {
    const withoutOrderRead = WF4_PERMISSION_SETS.sales.filter(
      (code) => code !== "sales-orders:READ",
    );
    const spy = await renderQueue(withoutOrderRead);
    // BO-UX-6: không hiện mảnh UUID làm "mã đơn" — nhãn trung tính
    const table = await screen.findByRole("table");
    expect(table.textContent).not.toContain(apiOrder.orderId.slice(0, 8));
    expect(within(table).getAllByText("Đơn hàng").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /SO-/ })).not.toBeInTheDocument();
    expect(callsTo(spy, DETAIL_PATH)).toBe(0);
  });

  it("hàng đã quyết (Approved / Rejected / Expired) lọt vào danh sách → không có nút mutating", async () => {
    await renderQueue(WF4_PERMISSION_SETS.sales, () =>
      requestPage([
        apiCancellationRequest({ requestId: "r-1", status: "APPROVED" }),
        apiCancellationRequest({ requestId: "r-2", status: "REJECTED" }),
        apiCancellationRequest({ requestId: "r-3", status: "EXPIRED" }),
      ]),
    );
    await screen.findAllByRole("link", { name: apiOrder.orderNumber });
    expect(screen.queryByRole("button", { name: /^Duyệt huỷ/ })).not.toBeInTheDocument();
  });
});

describe("Hàng đợi yêu cầu huỷ — trạng thái rỗng / lỗi", () => {
  it("không có yêu cầu nào đang chờ → EmptyState có hướng dẫn", async () => {
    await renderQueue(WF4_PERMISSION_SETS.sales, () => requestPage([]));
    expect(await screen.findByText("Không có yêu cầu huỷ nào đang chờ")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("API lỗi → thông báo lỗi tải + nút Thử lại (không phải trạng thái rỗng)", async () => {
    await renderQueue(WF4_PERMISSION_SETS.sales, () => {
      throw new ApiError(500, "INTERNAL_ERROR", "boom", undefined, "t-1");
    });
    expect(
      await screen.findByRole("button", { name: "Thử lại" }, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Không có yêu cầu huỷ nào đang chờ")).not.toBeInTheDocument();
  });
});

describe("Hàng đợi yêu cầu huỷ — duyệt / từ chối từ hàng", () => {
  it("duyệt từ hàng: mô tả hộp thoại nêu mã đơn đã tải, POST đúng đường dẫn, body {}", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiOrder });
    await renderQueue(WF4_PERMISSION_SETS.sales);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: `Duyệt huỷ — ${apiOrder.orderNumber}` }),
    );
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog).toHaveTextContent(new RegExp(apiOrder.orderNumber)));
    await user.click(within(dialog).getByRole("button", { name: "Duyệt và huỷ đơn" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        `/orders/${apiOrder.orderId}/cancellation-requests/${REQUEST_ID}/approval`,
        {},
        expect.anything(),
      ),
    );
  });

  it("BO-UX-35: hộp thoại duyệt từ hàng nhận số đã thu và giai đoạn in của chính hàng đó (không phải nút Từ chối)", async () => {
    await renderQueue(WF4_PERMISSION_SETS.sales, () =>
      requestPage([
        apiCancellationRequest({
          orderNumber: apiOrder.orderNumber,
          paidTotal: 8_586_000,
          printingStarted: false,
        }),
      ]),
    );
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: `Duyệt huỷ — ${apiOrder.orderNumber}` }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Khách đã trả")).toBeInTheDocument();
    expect(within(dialog).getByText(/8\.586\.000/)).toBeInTheDocument();
    expect(within(dialog).getByText("Chưa in hàng loạt")).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Giữ theo % số tiền đã thu" })).toBeDisabled();
  });
});
