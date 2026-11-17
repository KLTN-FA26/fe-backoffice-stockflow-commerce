import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderScreen } from "@/test/api-screen";

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
  allowedActions: { cancel: false, requestCancellation: false },
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

describe("Portal order detail (SCRUM-248 timeline, SCRUM-257 unavailable)", () => {
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

  it("reads the contract and stock groups of docs 17 §5.2 and offers no reorder (docs 13 BR-08)", async () => {
    mockApi("CUSTOMER", {
      get: {
        "/orders/me/o-1": () => ({
          ...detail("AWAITING_STOCK"),
          status: "AWAITING_STOCK",
          timeline: [
            {
              status: "PENDING_CONTRACT",
              statusGroup: "AWAITING_CONTRACT",
              occurredAt: "2026-10-10T02:00:00Z",
            },
            {
              status: "AWAITING_STOCK",
              statusGroup: "AWAITING_STOCK",
              occurredAt: "2026-10-11T02:00:00Z",
            },
          ],
        }),
      },
    });
    renderScreen(<PortalOrderDetail id="o-1" />, "CUSTOMER");
    expect(await screen.findByRole("heading", { name: "SO-20261014-000001" })).toBeInTheDocument();
    const timeline = screen.getByRole("heading", { name: "Tiến trình" })
      .parentElement as HTMLElement;
    expect(within(timeline).getByText("Chờ ký hợp đồng")).toBeInTheDocument();
    expect(within(timeline).getByText("Đang chờ hàng")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Đặt lại/ })).not.toBeInTheDocument();
  });

  it("a role without sales-orders:READ is refused without calling the API", async () => {
    const api = mockApi("QC_STAFF");
    renderScreen(<PortalOrderDetail id="o-1" />, "QC_STAFF");
    expect(await screen.findByText("Bạn không có quyền xem dữ liệu")).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith("/orders/me/o-1", expect.anything());
  });
});
