import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderScreen } from "@/test/api-screen";

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
        allowPrepaid: true,
        allowDeposit: true,
        allowCredit: false,
        defaultPaymentTerm: "DEPOSIT",
        depositPercent: 30,
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
    expect(screen.getByRole("button", { name: /Sửa/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạm khoá" })).not.toBeInTheDocument();
    expect(await screen.findByText("Trả trước · Đặt cọc")).toBeInTheDocument();
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
    expect(await screen.findByText("Gửi email thất bại")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Tạo báo giá/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Gửi lại lời mời/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/customers/c-1/portal-invitation"));
  });

  it("ECOMMERCE_ADMIN: may suspend/close an active customer, cannot create quotes", async () => {
    mockApi("ECOMMERCE_ADMIN", routes({ ...pending, status: "ACTIVE" }));
    renderScreen(<CustomerDetail id="c-1" />, "ECOMMERCE_ADMIN");
    expect(await screen.findByRole("button", { name: "Tạm khoá" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đóng tài khoản" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Tạo báo giá/ })).not.toBeInTheDocument();
    expect(screen.getByText(/chưa có quyền xem điều khoản thanh toán/)).toBeInTheDocument();
  });

  it("ORDER_COORDINATOR (no customer permission) is denied without fetching the customer", async () => {
    const api = mockApi("ORDER_COORDINATOR", routes(pending));
    renderScreen(<CustomerDetail id="c-1" />, "ORDER_COORDINATOR");
    expect(await screen.findByText("Không có quyền truy cập")).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith("/customers/c-1", expect.anything());
  });
});
