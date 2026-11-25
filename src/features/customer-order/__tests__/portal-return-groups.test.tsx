import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderScreen } from "@/test/api-screen";

import { PortalOrderDetail, PortalOrderList } from "..";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const card = (orderId: string, statusGroup: string) => ({
  orderId,
  orderNumber: `SO-20261124-${orderId}`,
  status: "DELIVERED",
  statusGroup,
  total: 3000000,
  currency: "VND",
  placedAt: "2026-11-20T02:00:00Z",
  lineCount: 1,
});

const page = (content: unknown[]) => ({
  items: content,
  page: 0,
  size: 10,
  totalElements: content.length,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
});

afterEach(() => vi.restoreAllMocks());

// Issue #262: BE `CustomerOrders.StatusGroup` có RETURN_REQUESTED (HT-1) và PARTIALLY_RETURNED (BE-35); trước đây
// z.enum thiếu hai giá trị này nên cả `/portal/orders` báo "Dữ liệu trả về không đúng định dạng".
describe("Portal orders — nhóm trạng thái trả hàng (issue #262)", () => {
  it("danh sách có đơn đang yêu cầu trả hàng / giữ một phần hàng vẫn hiện đủ, kèm nhãn Việt", async () => {
    mockApi("CUSTOMER", {
      get: {
        "/orders/me": () =>
          page([
            card("000001", "DELIVERED"),
            card("000002", "RETURN_REQUESTED"),
            card("000003", "PARTIALLY_RETURNED"),
          ]),
      },
    });
    renderScreen(<PortalOrderList />, "CUSTOMER");
    expect(await screen.findByText("SO-20261124-000002")).toBeInTheDocument();
    expect(screen.getByText("SO-20261124-000001")).toBeInTheDocument();
    expect(screen.getByText("SO-20261124-000003")).toBeInTheDocument();
    expect(screen.getByText("Đang yêu cầu trả hàng")).toBeInTheDocument();
    expect(screen.getByText("Giữ một phần hàng")).toBeInTheDocument();
    expect(screen.queryByText(/không đúng định dạng/)).not.toBeInTheDocument();
  });

  it("nhóm BE thêm sau này đọc thành 'Không rõ' thay vì làm hỏng cả danh sách", async () => {
    mockApi("CUSTOMER", {
      get: {
        "/orders/me": () => page([card("000001", "DELIVERED"), card("000009", "SOME_NEW_GROUP")]),
      },
    });
    renderScreen(<PortalOrderList />, "CUSTOMER");
    expect(await screen.findByText("SO-20261124-000009")).toBeInTheDocument();
    expect(screen.getByText("Không rõ")).toBeInTheDocument();
  });

  it("chi tiết đơn giữ một phần hàng: dòng thời gian có bước đang yêu cầu trả hàng, không có nút đổi trả", async () => {
    mockApi("CUSTOMER", {
      get: {
        "/orders/me/o-1": () => ({
          orderId: "o-1",
          orderNumber: "SO-20261124-000003",
          status: "PARTIALLY_REFUNDED",
          statusGroup: "PARTIALLY_RETURNED",
          total: 3000000,
          currency: "VND",
          placedAt: "2026-11-20T02:00:00Z",
          allowedActions: { cancel: false, requestCancellation: false },
          lines: [],
          timeline: [
            { status: "DELIVERED", statusGroup: "DELIVERED", occurredAt: "2026-11-21T02:00:00Z" },
            {
              status: "RETURN_REQUESTED",
              statusGroup: "RETURN_REQUESTED",
              occurredAt: "2026-11-22T02:00:00Z",
            },
            {
              status: "PARTIALLY_REFUNDED",
              statusGroup: "PARTIALLY_RETURNED",
              occurredAt: "2026-11-24T02:00:00Z",
            },
          ],
        }),
      },
    });
    renderScreen(<PortalOrderDetail id="o-1" />, "CUSTOMER");
    expect(await screen.findByRole("heading", { name: "SO-20261124-000003" })).toBeInTheDocument();
    const timeline = screen.getByRole("heading", { name: "Tiến trình" })
      .parentElement as HTMLElement;
    expect(within(timeline).getByText("Đang yêu cầu trả hàng")).toBeInTheDocument();
    expect(within(timeline).getByText("Giữ một phần hàng")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Yêu cầu đổi trả" })).not.toBeInTheDocument();
  });
});
