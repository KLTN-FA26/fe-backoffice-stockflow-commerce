import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { formatDate } from "@/lib/format/date";

import { apiOrder, apiOrderPage } from "../__fixtures__/order";
import { ORDER_PERMISSION_SETS, mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { OrderList } from "./OrderList";

import type { PermissionCode } from "@/lib/auth";
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
    // Ngày cùng định dạng với trang chi tiết (formatDate, Asia/Ho_Chi_Minh), không "7/9/2026"
    expect(screen.getAllByText(formatDate(apiOrder.placedAt)).length).toBeGreaterThan(0);
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
  it("đang tải → giữ header thật, skeleton bảng hiện bên dưới", async () => {
    // Dựng mock TRƯỚC khi render: /identity/me trả quyền, /orders treo (không bao giờ trả) để
    // giữ trạng thái đang tải — không phụ thuộc thứ tự request.
    vi.spyOn(api, "get").mockImplementation((url: string) => {
      if (url === "/identity/me/permissions") {
        return Promise.resolve({
          data: {
            roles: ["TEST"],
            permissions: ORDER_PERMISSION_SETS.salesStaff,
            dataScope: "ALL",
          },
        });
      }
      return new Promise(() => {});
    });
    renderOrderScreen(<OrderList />);

    // Quyền tải xong → header thật hiện; /orders còn treo → skeleton bảng bên dưới
    expect(await screen.findByRole("heading", { name: "Đơn hàng" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Đang tải nội dung" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

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

    expect(await screen.findByText(UI_LABELS.loadError.serverTitle)).toBeInTheDocument();
    // Lỗi server hiện câu tiếng Việt chung, không hiện message BE ("boom")
    expect(screen.getByText(UI_LABELS.loadError.serverDescription)).toBeInTheDocument();
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
    expect(screen.getByText("corr-9")).toBeInTheDocument();
    expect(screen.queryByText("Chưa có đơn hàng")).not.toBeInTheDocument();

    // 5xx là lỗi tạm thời: hook tự retry 2 lần (tổng 3 lần gọi) trước khi hiện màn lỗi
    const listCalls = () => vi.mocked(api.get).mock.calls.filter(([url]) => url === "/orders");
    expect(listCalls()).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(3));
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

describe("OrderList — kiểm quyền trước khi gọi API", () => {
  function renderWith(permissions: readonly PermissionCode[]) {
    mockOrderApiGet(permissions, { "/orders": () => apiOrderPage([apiOrder]) });
    return renderOrderScreen(<OrderList />);
  }

  it("WAREHOUSE_STAFF (không có sales-orders) → 'Bạn không có quyền', không gọi GET /orders", async () => {
    renderWith(ORDER_PERMISSION_SETS.none);

    // Màn chặn cả trang có tiêu đề trang (h1) + đường về, cùng kiểu màn lỗi chi tiết
    expect(
      await screen.findByRole("heading", { name: UI_LABELS.loadError.forbiddenTitle }),
    ).toBeInTheDocument();
    // Cùng bố cục màn lỗi NCC: PageHeader (h1) là tên trang
    expect(
      screen.getByRole("heading", { level: 1, name: UI_LABELS.order.pageTitle }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về trang tổng quan" })).toBeInTheDocument();
    expect(vi.mocked(api.get).mock.calls.some(([url]) => url === "/orders")).toBe(false);
  });

  it("chỉ VIEW_PAGE (thiếu READ) → mở được trang nhưng không gọi GET /orders, không hiện toolbar", async () => {
    renderWith(ORDER_PERMISSION_SETS.viewOnly);

    expect(await screen.findByText(UI_LABELS.order.noReadDescription)).toBeInTheDocument();
    expect(vi.mocked(api.get).mock.calls.some(([url]) => url === "/orders")).toBe(false);
    expect(screen.queryByPlaceholderText(/Tìm theo mã đơn/)).not.toBeInTheDocument();
  });
});
