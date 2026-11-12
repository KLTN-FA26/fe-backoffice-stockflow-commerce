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
  it("Sale (…:READ + …:UPDATE): thấy hàng, mã đơn link tới chi tiết đơn, nút Duyệt huỷ + Từ chối", async () => {
    await renderQueue(WF4_PERMISSION_SETS.sales);
    const link = await screen.findByRole("link", { name: apiOrder.orderNumber });
    expect(link).toHaveAttribute("href", `/admin/orders/${apiOrder.orderId}`);
    expect(screen.getByText("Khách yêu cầu")).toBeInTheDocument();
    expect(screen.getByText("Khách hoãn dự án")).toBeInTheDocument();
    expect(screen.getByText("Chờ xử lý")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duyệt huỷ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Từ chối" })).toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: "Duyệt huỷ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Từ chối" })).not.toBeInTheDocument();
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
    expect(await screen.findByText(apiOrder.orderId.slice(0, 8))).toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: "Duyệt huỷ" })).not.toBeInTheDocument();
    expect(screen.getByText("Hết hiệu lực")).toBeInTheDocument();
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
    await user.click(await screen.findByRole("button", { name: "Duyệt huỷ" }));
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
});
