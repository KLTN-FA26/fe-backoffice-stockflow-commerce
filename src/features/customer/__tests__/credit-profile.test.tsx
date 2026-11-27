import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, mockApi, renderScreen } from "@/test/api-screen";

import { CreditProfileCard } from "../components/detail/CreditProfileCard";

import type { TestRole } from "@/test/api-screen";

const CUSTOMER = "c-1";
const PATH = `/customers/${CUSTOMER}/credit-profile`;

const unconfigured = {
  customerId: CUSTOMER,
  configured: false,
  creditLimit: null,
  creditTermDays: null,
  currency: "VND",
  version: -1,
};
const configured = {
  ...unconfigured,
  configured: true,
  creditLimit: 50_000_000,
  creditTermDays: 30,
  note: "Khách lâu năm",
  version: 2,
};

function renderCard(role: TestRole, canApprove: boolean, searchParams = "") {
  return renderScreen(
    <CreditProfileCard customerId={CUSTOMER} canRead canApprove={canApprove} />,
    role,
    searchParams,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("CreditProfileCard — cấp / sửa hạn mức (AUTH-6)", () => {
  it("Kế toán, chưa cấu hình → nút Cấp hạn mức công nợ", async () => {
    mockApi("ACCOUNTANT", { get: { [PATH]: () => unconfigured } });
    renderCard("ACCOUNTANT", true);
    expect(await screen.findByRole("button", { name: "Cấp hạn mức công nợ" })).toBeInTheDocument();
  });

  it("Sales chỉ đọc (không có APPROVE) → không có nút sửa", async () => {
    mockApi("SALES_STAFF", { get: { [PATH]: () => configured } });
    renderCard("SALES_STAFF", false);
    expect(await screen.findByText("Khách lâu năm")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /hạn mức/ })).not.toBeInTheDocument();
  });

  it("A2: Sale (customer-credit-requests:CREATE) có lối tạo đề nghị thay khách; Kế toán thì không", async () => {
    mockApi("SALES_STAFF", { get: { [PATH]: () => configured } });
    renderCard("SALES_STAFF", false);
    expect(await screen.findByRole("link", { name: "Đề nghị cấp hạn mức" })).toHaveAttribute(
      "href",
      `/admin/payment/credit-requests?create=${CUSTOMER}`,
    );
  });

  it("A2: Kế toán không thấy lối tạo đề nghị", async () => {
    mockApi("ACCOUNTANT", { get: { [PATH]: () => configured } });
    renderCard("ACCOUNTANT", true);
    await screen.findByText("Khách lâu năm");
    expect(screen.queryByRole("link", { name: "Đề nghị cấp hạn mức" })).not.toBeInTheDocument();
  });

  it("?creditProfile=edit không mở hộp thoại khi thiếu quyền duyệt", async () => {
    mockApi("SALES_STAFF", { get: { [PATH]: () => configured } });
    renderCard("SALES_STAFF", false, "?creditProfile=edit");
    await screen.findByText("Khách lâu năm");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cấp lần đầu gửi expectedVersion -1 và số thuần", async () => {
    const api = mockApi("ACCOUNTANT", {
      get: { [PATH]: () => unconfigured },
      put: { [PATH]: () => configured },
    });
    renderCard("ACCOUNTANT", true, "?creditProfile=edit");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Cấp hạn mức công nợ")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Hạn mức công nợ"), "50000000");
    await userEvent.type(within(dialog).getByLabelText(/Số ngày được nợ/), "30");
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledWith(PATH, {
      creditLimit: 50_000_000,
      creditTermDays: 30,
      expectedVersion: -1,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("sửa: ô có sẵn giá trị hiện tại, gửi version đã mở; để trống cả hai = bỏ công nợ", async () => {
    const api = mockApi("ACCOUNTANT", {
      get: { [PATH]: () => configured },
      put: { [PATH]: () => unconfigured },
    });
    renderCard("ACCOUNTANT", true, "?creditProfile=edit");
    const dialog = await screen.findByRole("dialog");
    const limit = within(dialog).getByLabelText("Hạn mức công nợ");
    const days = within(dialog).getByLabelText(/Số ngày được nợ/);
    expect(limit).toHaveValue("50.000.000");
    expect(days).toHaveValue("30");
    await userEvent.clear(limit);
    await userEvent.clear(days);
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledWith(PATH, {
      creditLimit: null,
      creditTermDays: null,
      note: "Khách lâu năm",
      expectedVersion: 2,
    });
  });

  it("chỉ nhập hạn mức → lỗi tại ô số ngày, không gọi PUT", async () => {
    const api = mockApi("ACCOUNTANT", { get: { [PATH]: () => unconfigured }, put: {} });
    renderCard("ACCOUNTANT", true, "?creditProfile=edit");
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Hạn mức công nợ"), "1000000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
    expect(await within(dialog).findByText(/Nhập cả hạn mức và số ngày/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Số ngày được nợ/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(api.put).not.toHaveBeenCalled();
  });

  it("số ngày > 365 → lỗi tại ô", async () => {
    const api = mockApi("ACCOUNTANT", { get: { [PATH]: () => unconfigured }, put: {} });
    renderCard("ACCOUNTANT", true, "?creditProfile=edit");
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Hạn mức công nợ"), "1000000");
    await userEvent.type(within(dialog).getByLabelText(/Số ngày được nợ/), "400");
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
    expect(
      await within(dialog).findByText(/Số ngày là số nguyên từ 0 đến 365/),
    ).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  it("409 OPTIMISTIC_LOCK → câu 'đã tải lại', tải lại GET, các ô cũ không ghi đè được", async () => {
    let current = { ...configured };
    const api = mockApi("ACCOUNTANT", {
      get: { [PATH]: () => current },
      put: {
        [PATH]: () => {
          current = { ...configured, creditLimit: 80_000_000, version: 3 };
          throw apiError(409, "OPTIMISTIC_LOCK");
        },
      },
    });
    renderCard("ACCOUNTANT", true, "?creditProfile=edit");
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
    expect(
      await within(dialog).findByText("Hạn mức công nợ vừa được người khác sửa, đã tải lại."),
    ).toBeInTheDocument();
    expect(await within(dialog).findByText(/Người khác vừa lưu hạn mức/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Lưu" })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Tải lại theo bản mới" }));
    expect(within(dialog).getByLabelText("Hạn mức công nợ")).toHaveValue("80.000.000");
    expect(api.put).toHaveBeenCalledWith(PATH, expect.objectContaining({ expectedVersion: 2 }));
  });

  it("PAYMENT_SCHEDULE_NEEDS_CREDIT → câu hướng dẫn đổi lịch thanh toán trước", async () => {
    mockApi("ACCOUNTANT", {
      get: { [PATH]: () => configured },
      put: {
        [PATH]: () => {
          throw apiError(409, "PAYMENT_SCHEDULE_NEEDS_CREDIT");
        },
      },
    });
    renderCard("ACCOUNTANT", true, "?creditProfile=edit");
    const dialog = await screen.findByRole("dialog");
    await userEvent.clear(within(dialog).getByLabelText("Hạn mức công nợ"));
    await userEvent.clear(within(dialog).getByLabelText(/Số ngày được nợ/));
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
    expect(await within(dialog).findByText(/Đổi lịch đó trước khi bỏ công nợ/)).toBeInTheDocument();
  });

  it("đến từ đơn bị giữ → link quay lại; đường dẫn ngoài back-office bị bỏ qua", async () => {
    mockApi("ACCOUNTANT", { get: { [PATH]: () => configured } });
    renderCard(
      "ACCOUNTANT",
      true,
      `?creditReturnTo=${encodeURIComponent("/admin/orders/credit-holds")}`,
    );
    expect(await screen.findByRole("link", { name: "Quay lại" })).toHaveAttribute(
      "href",
      "/admin/orders/credit-holds",
    );
  });

  it("creditReturnTo ra ngoài back-office → không có link", async () => {
    mockApi("ACCOUNTANT", { get: { [PATH]: () => configured } });
    renderCard(
      "ACCOUNTANT",
      true,
      `?creditReturnTo=${encodeURIComponent("https://evil.example/admin/x")}`,
    );
    await screen.findByText("Khách lâu năm");
    expect(screen.queryByRole("link", { name: "Quay lại" })).not.toBeInTheDocument();
  });
});
