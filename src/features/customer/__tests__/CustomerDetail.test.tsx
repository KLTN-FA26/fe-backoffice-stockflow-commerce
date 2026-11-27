import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bePage, mockApi, renderScreen } from "@/test/api-screen";

import { CustomerDetail } from "../components/CustomerDetail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const pending = {
  customerId: "c-1",
  userId: "u-1",
  fullName: "Công ty Bao Bì Xanh",
  email: "mua@xanh.example.com",
  status: "PENDING_ACTIVATION",
  version: 0,
  createdAt: "2026-10-14T02:00:00Z",
};

function routes(customer: Record<string, unknown>) {
  return {
    get: {
      "/customers/c-1": () => customer,
      "/customers/c-1/status-history": () => [
        { toStatus: customer.status, changedAt: "2026-10-14T02:00:00Z" },
      ],
      "/customers/c-1/portal-invitation": () => ({
        customerId: "c-1",
        state: "PENDING",
        issuedAt: "2026-10-14T02:00:00Z",
        expiresAt: "2026-10-17T02:00:00Z",
        delivery: "FAILED",
      }),
      "/customers/c-1/credit-profile": () => ({
        customerId: "c-1",
        configured: true,
        creditLimit: 50_000_000,
        creditTermDays: 30,
        currency: "VND",
        version: 0,
      }),
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("CustomerDetail — action gating by real role permissions", () => {
  it("SALES_STAFF: edit + create quote, read-only payment terms, no status change", async () => {
    mockApi("SALES_STAFF", routes({ ...pending, status: "ACTIVE" }));
    renderScreen(<CustomerDetail id="c-1" />, "SALES_STAFF");
    expect(await screen.findByRole("heading", { name: "Công ty Bao Bì Xanh" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tạo báo giá/ })).toHaveAttribute(
      "href",
      "/admin/quotes/create?customerId=c-1",
    );
    // "Chỉnh sửa" ở đầu khung hồ sơ (backoffice-erp-ui B11); menu "⋯" chỉ có "Báo giá của khách" — không có quyền đổi
    // trạng thái thì không có "Tạm khoá"
    expect(screen.getByRole("button", { name: /Chỉnh sửa/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Thao tác khác với khách hàng" }));
    expect(await screen.findByRole("link", { name: /Báo giá của khách/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạm khoá" })).not.toBeInTheDocument();
    expect(await screen.findByText("30 ngày")).toBeInTheDocument();
  });

  it("SALES_STAFF on a pending customer sees the honest FAILED delivery and can resend", async () => {
    const api = mockApi("SALES_STAFF", {
      ...routes(pending),
      post: {
        "/customers/c-1/portal-invitation": () => ({
          customer: pending,
          invitation: {
            issuedAt: "2026-10-14T03:00:00Z",
            expiresAt: "2026-10-17T03:00:00Z",
            delivery: "SENT",
          },
        }),
      },
    });
    renderScreen(<CustomerDetail id="c-1" />, "SALES_STAFF");
    // Khách chờ kích hoạt: tab "Lời mời portal" mở sẵn (việc tiếp theo là lời mời)
    expect(await screen.findByRole("tab", { name: "Lời mời portal" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByText("Gửi email thất bại")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Tạo báo giá/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Gửi lại lời mời/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/customers/c-1/portal-invitation"));
  });

  it("ECOMMERCE_ADMIN: may suspend/close an active customer, cannot create quotes", async () => {
    mockApi("ECOMMERCE_ADMIN", routes({ ...pending, status: "ACTIVE" }));
    renderScreen(<CustomerDetail id="c-1" />, "ECOMMERCE_ADMIN");
    // Bước phá huỷ gom vào menu "⋯" của header đối tượng
    await userEvent.click(
      await screen.findByRole("button", { name: "Thao tác khác với khách hàng" }),
    );
    expect(await screen.findByRole("button", { name: "Tạm khoá" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đóng tài khoản" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Tạo báo giá/ })).not.toBeInTheDocument();
    expect(screen.getByText(/chưa có quyền xem hạn mức công nợ/)).toBeInTheDocument();
  });

  it("ORDER_COORDINATOR (no customer permission) is denied without fetching the customer", async () => {
    const api = mockApi("ORDER_COORDINATOR", routes(pending));
    renderScreen(<CustomerDetail id="c-1" />, "ORDER_COORDINATOR");
    expect(await screen.findByText("Không có quyền truy cập")).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith("/customers/c-1", expect.anything());
  });

  it("bo-30: tab Báo giá / Đơn hàng liệt kê chứng từ của khách (lọc customerId), link tới từng chứng từ", async () => {
    const quote = {
      id: "q-1",
      quoteNumber: "QT-20261124-7022",
      customerId: "c-1",
      status: "SENT",
      revision: 2,
      validUntil: "2026-12-01T00:00:00Z",
      createdAt: "2026-11-24T02:00:00Z",
      version: 1,
      total: 16_446_780,
      priceReviewPending: false,
    };
    const order = {
      orderId: "o-1",
      orderNumber: "SO-20261126-000001",
      customerId: "c-1",
      status: "DELIVERED",
      totalAmount: 32_000_000,
      currency: "VND",
      placedAt: "2026-11-26T02:00:00Z",
    };
    const base = routes({ ...pending, status: "ACTIVE" });
    const api = mockApi("SALES_STAFF", {
      get: { ...base.get, "/quotes": () => bePage([quote]), "/orders": () => bePage([order]) },
    });
    renderScreen(<CustomerDetail id="c-1" />, "SALES_STAFF", "?tab=quotes");
    expect(await screen.findByRole("link", { name: /QT-20261124-7022/ })).toHaveAttribute(
      "href",
      "/admin/quotes/q-1",
    );
    expect(screen.getByText("Đã gửi")).toBeInTheDocument();
    const quoteCall = api.get.mock.calls.find((c) => c[0] === "/quotes");
    expect((quoteCall?.[1] as { params: URLSearchParams }).params.get("customerId")).toBe("c-1");

    await userEvent.click(screen.getByRole("tab", { name: "Đơn hàng" }));
    expect(await screen.findByRole("link", { name: "SO-20261126-000001" })).toHaveAttribute(
      "href",
      "/admin/orders/o-1",
    );
    expect(screen.getByText("Đã giao")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở danh sách đơn của khách" })).toHaveAttribute(
      "href",
      "/admin/orders?customer=c-1",
    );
  });

  it("bo-30: không có quyền đọc báo giá / đơn → không có tab đó", async () => {
    mockApi("ECOMMERCE_ADMIN", routes({ ...pending, status: "ACTIVE" }));
    renderScreen(<CustomerDetail id="c-1" />, "ECOMMERCE_ADMIN");
    expect(await screen.findByRole("tab", { name: "Pháp lý & công nợ" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Báo giá" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Đơn hàng" })).toBeNull();
  });
});
