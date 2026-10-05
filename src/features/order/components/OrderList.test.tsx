import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { apiOrder, apiOrderPage } from "../__fixtures__/order";
import { ORDER_PERMISSION_SETS, mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { OrderList } from "./OrderList";

import type { RouteHandler } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const secondOrder = {
  ...apiOrder,
  orderId: "1c7a8d2f-5d6e-4a2b-8b88-3f4e7a2e3b21",
  orderNumber: "SO-20260908-000432",
  status: "SHIPPED" as const,
};

function renderList(handler: RouteHandler, searchParams = "") {
  mockOrderApiGet(ORDER_PERMISSION_SETS.salesStaff, { "/orders": handler });
  return renderOrderScreen(<OrderList />, searchParams);
}

/** Query string của lần gọi GET /orders gần nhất. */
function lastListQuery(): URLSearchParams {
  const calls = vi.mocked(api.get).mock.calls.filter(([url]) => url === "/orders");
  const config = calls.at(-1)?.[1] as { params?: unknown } | undefined;
  return new URLSearchParams(String(config?.params ?? ""));
}

afterEach(() => vi.restoreAllMocks());

describe("OrderList — phân trang/lọc phía server", () => {
  it("mặc định gửi page=0&size=15, render đơn với nhãn trạng thái tiếng Việt", async () => {
    renderList(() => apiOrderPage([apiOrder, secondOrder]));

    expect(await screen.findByText(apiOrder.orderNumber)).toBeInTheDocument();
    expect(screen.getByText(secondOrder.orderNumber)).toBeInTheDocument();
    expect(String(lastListQuery())).toBe("page=0&size=15");
    // Footer phân trang server: "Hiển thị x–y / tổng" lấy totalElements từ BE
    expect(screen.getByText("Hiển thị 1–2 / 2")).toBeInTheDocument();
    expect(screen.queryByText("PENDING_PAYMENT")).not.toBeInTheDocument();
  });

  it("URL ?status=Paid&q=SO-2026&page=2 → gửi status=PAID, search, page=1 (BE đánh số từ 0)", async () => {
    renderList(() => apiOrderPage([]), "?status=Paid&q=SO-2026&page=2");

    await waitFor(() => expect(lastListQuery().get("status")).toBe("PAID"));
    const query = lastListQuery();
    expect(query.get("search")).toBe("SO-2026");
    expect(query.get("page")).toBe("1");
  });
});

describe("OrderList — 4 trạng thái màn hình (api-conventions §8)", () => {
  it("chưa có đơn nào → 'Chưa có đơn hàng'", async () => {
    renderList(() => apiOrderPage([]));
    expect(await screen.findByText("Chưa có đơn hàng")).toBeInTheDocument();
  });

  it("lọc không ra kết quả → 'Không tìm thấy kết quả' + Bỏ bộ lọc (khác màn chưa có đơn)", async () => {
    renderList(() => apiOrderPage([]), "?q=khong-co");

    expect(await screen.findByText("Không tìm thấy kết quả")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ bộ lọc" })).toBeInTheDocument();
    expect(screen.queryByText("Chưa có đơn hàng")).not.toBeInTheDocument();
  });

  it("lỗi 5xx → không nuốt thành danh sách trống, có Thử lại gọi lại API", async () => {
    renderList(() => {
      throw new ApiError(500, "INTERNAL_ERROR", "boom", undefined, "corr-9");
    });

    expect(await screen.findByText("Không tải được danh sách đơn hàng")).toBeInTheDocument();
    expect(screen.getByText(/traceId: corr-9/)).toBeInTheDocument();
    expect(screen.queryByText("Chưa có đơn hàng")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() =>
      expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === "/orders")).toHaveLength(2),
    );
  });

  it("403 → 'Bạn không có quyền', không có nút Thử lại", async () => {
    renderList(() => {
      throw new ApiError(403, "FORBIDDEN", "Not authorised");
    });

    expect(await screen.findByText("Bạn không có quyền")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
  });

  it("response sai hợp đồng (parse fail) → 'Dữ liệu trả về không đúng định dạng'", async () => {
    renderList(() => ({ items: [{ orderId: "x" }] }));
    expect(await screen.findByText("Dữ liệu trả về không đúng định dạng")).toBeInTheDocument();
  });
});
