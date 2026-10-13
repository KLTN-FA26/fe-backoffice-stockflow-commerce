import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, mockApi, renderScreen } from "@/test/api-screen";

import { CustomerCreate } from "../components/CustomerCreate";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));

afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
});

async function fillRequired() {
  await userEvent.type(await screen.findByLabelText(/Tên công ty/), "Quán Cà Phê Nhỏ");
  await userEvent.type(screen.getByLabelText(/Họ tên/), "Nguyễn An");
  await userEvent.type(screen.getByLabelText(/^Email/), "an@example.com");
}

const created = (companyName: string) => ({
  customer: {
    customerId: "c-9",
    fullName: companyName,
    email: "an@example.com",
    status: "PENDING_ACTIVATION",
    version: 0,
    createdAt: "2026-10-14T02:00:00Z",
  },
  invitation: {
    issuedAt: "2026-10-14T02:00:00Z",
    expiresAt: "2026-10-17T02:00:00Z",
    delivery: "SENT",
  },
});

describe("CustomerCreate (SCRUM-451)", () => {
  it("tax code optional; DEPOSIT needs a percent; never offers CREDIT; posts real fields only", async () => {
    const api = mockApi("SALES_STAFF", {
      post: {
        "/customers": (_params, body) => created((body as { companyName: string }).companyName),
      },
    });
    renderScreen(<CustomerCreate />, "SALES_STAFF");
    await fillRequired();
    expect(screen.queryByRole("radio", { name: "Công nợ" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Đặt cọc" }));
    await userEvent.click(screen.getByRole("button", { name: /Tạo khách và gửi lời mời/ }));
    expect(await screen.findByText("Nhập tỷ lệ cọc đã thoả thuận")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(/Tỷ lệ cọc/), "30");
    await userEvent.click(screen.getByRole("button", { name: /Tạo khách và gửi lời mời/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/customers/c-9"));
    expect(api.post).toHaveBeenCalledWith("/customers", {
      companyName: "Quán Cà Phê Nhỏ",
      contactName: "Nguyễn An",
      email: "an@example.com",
      paymentTerm: "DEPOSIT",
      depositPercent: 30,
    });
  });

  it("maps BE duplicate tax code (409) to the tax code field and keeps the form", async () => {
    mockApi("SALES_STAFF", {
      post: {
        "/customers": () => {
          throw apiError(409, "CUSTOMER_TAX_CODE_ALREADY_EXISTS");
        },
      },
    });
    renderScreen(<CustomerCreate />, "SALES_STAFF");
    await fillRequired();
    await userEvent.type(screen.getByLabelText(/Mã số thuế/), "0312345678");
    await userEvent.click(screen.getByRole("button", { name: /Tạo khách và gửi lời mời/ }));
    expect(
      await screen.findByText("Mã số thuế này đã thuộc về một khách hàng khác."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Mã số thuế/)).toHaveAttribute("aria-invalid", "true");
    expect(replace).not.toHaveBeenCalled();
  });

  it("ORDER_COORDINATOR cannot open the create screen", async () => {
    mockApi("ORDER_COORDINATOR");
    renderScreen(<CustomerCreate />, "ORDER_COORDINATOR");
    expect(await screen.findByText("Không có quyền truy cập")).toBeInTheDocument();
  });
});
