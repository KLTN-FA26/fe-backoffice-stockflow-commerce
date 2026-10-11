import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { apiOrder, apiOrderPage } from "../__fixtures__/order";
import {
  ORDER_PERMISSION_SETS,
  mockOrderApiGet,
  pickOrderSelectOption,
  renderOrderScreen,
} from "../__fixtures__/render";
import { CreditHoldList } from "./credit-hold/CreditHoldList";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const heldOrder = {
  ...apiOrder,
  status: "ON_HOLD" as const,
  paymentTerm: "CREDIT" as const,
  paymentStatus: "ON_CREDIT" as const,
};
const hold = {
  order: heldOrder,
  checkedAt: "2026-09-07T03:16:00Z",
  creditLimit: 1_000_000,
  exposure: 800_000,
  orderAmount: 350_000,
};
const APPROVE_PATH = `/orders/${apiOrder.orderId}/credit-approval`;
const REJECT_PATH = `/orders/${apiOrder.orderId}/credit-rejection`;

function renderList(permissions: readonly PermissionCode[], items: unknown[] = [hold]) {
  const get = mockOrderApiGet(permissions, {
    "/orders/credit-holds": () => apiOrderPage(items as never[]),
  });
  renderOrderScreen(<CreditHoldList />);
  return get;
}

afterEach(() => vi.restoreAllMocks());

const DIALOG_FLOW_TIMEOUT_MS = 15_000;

describe("Credit hold — danh sách (SCRUM-427)", () => {
  it("hiện số liệu hạn mức + phần vượt (docs 14 BR-06: dư nợ + đơn − hạn mức)", async () => {
    renderList(ORDER_PERMISSION_SETS.accountant);

    const row = (await screen.findByText(apiOrder.orderNumber)).closest("tr");
    expect(row).not.toBeNull();
    // 800.000 + 350.000 − 1.000.000 = 150.000
    expect(within(row as HTMLElement).getByText(/150\.000/)).toBeInTheDocument();
  });

  it("ACCOUNTANT (APPROVE) thấy Duyệt / Từ chối; mã đơn không là link (không có quyền sales-orders)", async () => {
    renderList(ORDER_PERMISSION_SETS.accountant);

    expect(
      await screen.findByRole("button", { name: /^Duyệt vượt hạn mức đơn/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Từ chối vượt hạn mức đơn/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: apiOrder.orderNumber })).not.toBeInTheDocument();
  });

  it("ORDER_COORDINATOR / SALES_STAFF chỉ xem — không có nút duyệt, mã đơn là link", async () => {
    renderList(ORDER_PERMISSION_SETS.coordinator);

    expect(await screen.findByRole("link", { name: apiOrder.orderNumber })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Duyệt vượt hạn mức/ })).not.toBeInTheDocument();
  });

  it("không có quyền sales-order-credit-holds → 'Bạn không có quyền', không gọi API", async () => {
    const get = renderList(ORDER_PERMISSION_SETS.readOnly);

    expect(await screen.findByText("Bạn không có quyền")).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === "/orders/credit-holds")).toBe(false);
  });

  it("hàng đợi trống → EmptyState riêng", async () => {
    renderList(ORDER_PERMISSION_SETS.accountant, []);
    expect(await screen.findByText("Không có đơn vượt hạn mức")).toBeInTheDocument();
  });
});

// Dialog nhiều bước (Radix Select trong jsdom) chậm khi chạy song song cả bộ test → nới timeout
describe("Credit hold — duyệt / từ chối", { timeout: DIALOG_FLOW_TIMEOUT_MS }, () => {
  it("duyệt: ghi chú bắt buộc → POST /credit-approval {note}", async () => {
    const user = userEvent.setup();
    renderList(ORDER_PERMISSION_SETS.accountant);
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: { ...heldOrder, status: "CONFIRMED" } });

    await user.click(await screen.findByRole("button", { name: /^Duyệt vượt hạn mức đơn/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Duyệt" })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Ghi chú duyệt/), "  Khách đã cam kết  ");
    await user.click(within(dialog).getByRole("button", { name: "Duyệt" }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(APPROVE_PATH, { note: "Khách đã cam kết" }),
    );
  });

  it("từ chối chuyển cọc: % ngoài (0,100) báo lỗi; % thập phân hợp lệ → body {action, depositPercent, note}", async () => {
    const user = userEvent.setup();
    renderList(ORDER_PERMISSION_SETS.accountant);
    const post = vi.spyOn(api, "post").mockResolvedValue({
      data: { ...heldOrder, status: "PENDING_PAYMENT", paymentTerm: "DEPOSIT" },
    });

    await user.click(await screen.findByRole("button", { name: /^Từ chối vượt hạn mức đơn/ }));
    await pickOrderSelectOption(user, /Cách xử lý/, "Chuyển sang đặt cọc");
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Ghi chú/), "Chuyển cọc");
    const percent = within(dialog).getByLabelText(/Tỷ lệ cọc/);
    await user.type(percent, "100");
    expect(
      within(dialog).getByText(/Tỷ lệ cọc phải lớn hơn 0% và nhỏ hơn 100%/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Từ chối" })).toBeDisabled();

    // BE nhận BigDecimal → 30.5% hợp lệ; validation gốc của trình duyệt (step) không được chặn submit
    await user.clear(percent);
    await user.type(percent, "30.5");
    expect(percent).toBeValid();
    await user.click(within(dialog).getByRole("button", { name: "Từ chối" }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(REJECT_PATH, {
        action: "SWITCH_TO_DEPOSIT",
        depositPercent: 30.5,
        note: "Chuyển cọc",
      }),
    );
  });

  it("PAYMENT_TERM_NOT_ALLOWED → lý do hiện trong dialog (docs 14 BR-05)", async () => {
    const user = userEvent.setup();
    renderList(ORDER_PERMISSION_SETS.accountant);
    vi.spyOn(api, "post").mockRejectedValue(new ApiError(409, "PAYMENT_TERM_NOT_ALLOWED", "x"));

    await user.click(await screen.findByRole("button", { name: /^Từ chối vượt hạn mức đơn/ }));
    await pickOrderSelectOption(user, /Cách xử lý/, "Chuyển sang trả trước 100%");
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Ghi chú/), "Thử");
    await user.click(within(dialog).getByRole("button", { name: "Từ chối" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("BR-05");
  });

  it("ORDER_NOT_ON_CREDIT_HOLD (người khác đã xử lý) → đóng dialog, tải lại danh sách", async () => {
    const user = userEvent.setup();
    const get = renderList(ORDER_PERMISSION_SETS.accountant);
    vi.spyOn(api, "post").mockRejectedValue(new ApiError(409, "ORDER_NOT_ON_CREDIT_HOLD", "x"));

    await user.click(await screen.findByRole("button", { name: /^Duyệt vượt hạn mức đơn/ }));
    await user.type(await screen.findByLabelText(/Ghi chú duyệt/), "Ok");
    const before = get.mock.calls.filter(([url]) => url === "/orders/credit-holds").length;
    await user.click(screen.getByRole("button", { name: "Duyệt" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(
        get.mock.calls.filter(([url]) => url === "/orders/credit-holds").length,
      ).toBeGreaterThan(before),
    );
  });
});
