import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, mockApi, renderScreen } from "@/test/api-screen";

import { PortalOrderDetail } from "..";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const detail = (statusGroup: string) => ({
  orderId: "o-1",
  orderNumber: "SO-20261014-000001",
  status: "DELIVERED",
  statusGroup,
  total: 3000000,
  currency: "VND",
  placedAt: "2026-10-10T02:00:00Z",
  lines: [
    {
      lineId: "l-1",
      sku: "CUP-PAPER-12OZ",
      quantity: 1200,
      unitPrice: 2500,
      lineTotal: 3000000,
      production: { state: "DONE", goodQuantity: 1200 },
    },
  ],
  timeline: [
    { status: "CONFIRMED", statusGroup: "CONFIRMED", occurredAt: "2026-10-10T02:00:00Z" },
    { status: "DELIVERED", statusGroup: "DELIVERED", occurredAt: "2026-10-13T02:00:00Z" },
  ],
});

afterEach(() => vi.restoreAllMocks());

describe("Portal order detail (SCRUM-248 timeline, R1b reorder, SCRUM-257 unavailable)", () => {
  it("renders the BE timeline read-only and an honest disabled return request", async () => {
    mockApi("CUSTOMER", { get: { "/orders/me/o-1": () => detail("DELIVERED") } });
    renderScreen(<PortalOrderDetail id="o-1" />, "CUSTOMER");
    expect(await screen.findByRole("heading", { name: "SO-20261014-000001" })).toBeInTheDocument();
    const timeline = screen.getByRole("heading", { name: "Tiến trình" })
      .parentElement as HTMLElement;
    expect(within(timeline).getByText("Đã xác nhận")).toBeInTheDocument();
    expect(within(timeline).getByText("Đã giao")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yêu cầu đổi trả" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /thêm sự kiện/i })).not.toBeInTheDocument();
  });

  it("reorder posts a stable requestId and maps ORDER_NOT_QUOTED to Vietnamese", async () => {
    const api = mockApi("CUSTOMER", {
      get: { "/orders/me/o-1": () => detail("DELIVERED") },
      post: {
        "/orders/o-1/reorder": () => {
          throw apiError(409, "ORDER_NOT_QUOTED");
        },
      },
    });
    renderScreen(<PortalOrderDetail id="o-1" />, "CUSTOMER");
    await userEvent.click(await screen.findByRole("button", { name: /Đặt lại/ }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Gửi yêu cầu báo giá",
      }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/orders/o-1/reorder", {
        requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      }),
    );
    expect(await screen.findByText(/không đặt từ báo giá/)).toBeInTheDocument();
  });

  it("a role without sales-orders:READ is refused without calling the API", async () => {
    const api = mockApi("QC_STAFF");
    renderScreen(<PortalOrderDetail id="o-1" />, "QC_STAFF");
    expect(await screen.findByText("Bạn không có quyền xem dữ liệu")).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith("/orders/me/o-1", expect.anything());
  });
});
