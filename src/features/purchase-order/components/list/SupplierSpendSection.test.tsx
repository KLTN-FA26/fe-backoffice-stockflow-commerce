import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PO_PERMISSION_SETS,
  bePage,
  mockApi,
  pickSelectOption,
  renderPoScreen,
} from "../../__fixtures__/render";
import { SupplierSpendSection } from "./SupplierSpendSection";

afterEach(() => vi.restoreAllMocks());

function renderSpend(searchParams = "") {
  const spies = mockApi(PO_PERMISSION_SETS.readOnly, {
    "/purchase-orders/reports/supplier-spend": () => bePage([]),
  });
  renderPoScreen(<SupplierSpendSection canRead />, searchParams);
  return spies;
}

describe("SupplierSpendSection", () => {
  it("chưa có chi tiêu ≠ lọc ngày không ra kết quả (hai EmptyState khác nhau)", async () => {
    renderSpend();
    expect(await screen.findByText("Chưa có chi tiêu bằng VND")).toBeInTheDocument();
  });

  it("lọc ngày trên URL không ra kết quả → nút Bỏ lọc ngày", async () => {
    renderSpend("?spendFrom=2026-01-01&spendTo=2026-01-31");
    expect(
      await screen.findByText("Không có chi tiêu trong khoảng ngày đã chọn"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ lọc ngày" })).toBeInTheDocument();
  });

  it("tiền tệ + khoảng ngày đọc từ URL và gửi lên BE", async () => {
    const { get } = renderSpend("?spendCurrency=EUR&spendFrom=2026-01-01");
    await screen.findByText("Không có chi tiêu trong khoảng ngày đã chọn");
    const call = get.mock.calls.find(([url]) => url === "/purchase-orders/reports/supplier-spend");
    expect(call?.[1]).toMatchObject({
      params: { currency: "EUR", expectedAtFrom: "2026-01-01", page: 0 },
    });
  });

  it("'Từ' sau 'Đến' → báo lỗi, khoá nút Lọc", async () => {
    const user = userEvent.setup();
    renderSpend();
    await screen.findByText("Chưa có chi tiêu bằng VND");
    await user.type(screen.getByLabelText("Giao dự kiến từ"), "2026-02-10");
    await user.type(screen.getByLabelText("Đến"), "2026-02-01");
    expect(screen.getByRole("alert")).toHaveTextContent("phải từ ngày");
    expect(screen.getByRole("button", { name: "Lọc" })).toBeDisabled();
  });

  it("chọn 'Mã khác…' nhưng chưa nhập → nói rõ vẫn đang xem tiền tệ cũ", async () => {
    const user = userEvent.setup();
    renderSpend();
    await screen.findByText("Chưa có chi tiêu bằng VND");
    await pickSelectOption(user, "Tiền tệ", "Mã khác…");
    expect(screen.getByText(/Đang xem VND/)).toBeInTheDocument();
  });
});
