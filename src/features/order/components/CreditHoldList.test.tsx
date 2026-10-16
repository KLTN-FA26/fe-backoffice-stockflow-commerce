import { focusManager } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES, CREDIT_HOLD_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { apiCreditPosition, apiOrder, apiOrderPage } from "../__fixtures__/order";
import {
  ORDER_PERMISSION_SETS,
  mockOrderApiGet,
  pickOrderSelectOption,
  renderOrderScreen,
} from "../__fixtures__/render";
import { CreditHoldList } from "./credit-hold/CreditHoldList";

import type { PermissionCode } from "@/lib/auth";
import type { RouteHandler } from "../__fixtures__/render";

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

const positionPath = (customerId: string | null | undefined) =>
  `/orders/credit-position/${customerId}`;
const POSITION_PATH = positionPath(apiOrder.customerId);

function renderList(
  permissions: readonly PermissionCode[],
  items: unknown[] = [hold],
  positions: Record<string, RouteHandler> = { [POSITION_PATH]: () => apiCreditPosition },
) {
  const get = mockOrderApiGet(permissions, {
    "/orders/credit-holds": () => apiOrderPage(items as never[]),
    ...positions,
  });
  renderOrderScreen(<CreditHoldList />);
  return get;
}

function callsTo(get: ReturnType<typeof renderList>, path: string): number {
  return get.mock.calls.filter(([url]) => url === path).length;
}

/** Mọi thao tác ghi đơn gửi kèm Idempotency-Key (header riêng request, không vào body). */
const WITH_IDEMPOTENCY_KEY = expect.objectContaining({
  headers: { "Idempotency-Key": expect.any(String) },
});

afterEach(() => vi.restoreAllMocks());

const DIALOG_FLOW_TIMEOUT_MS = 15_000;

describe("Credit hold — danh sách (SCRUM-427)", () => {
  it("A. vượt > 0 → lý do 'Vượt hạn mức' + số vượt định dạng tiền (docs 14 BR-06)", async () => {
    renderList(ORDER_PERMISSION_SETS.accountant);

    const row = (await screen.findByText(apiOrder.orderNumber)).closest("tr");
    expect(row).not.toBeNull();
    // 800.000 + 350.000 − 1.000.000 = 150.000
    const reason = within(row as HTMLElement).getByText(/^Vượt hạn mức/);
    expect(reason).toHaveTextContent(/^Vượt hạn mức\s*150\.000\s*₫$/);
    expect(within(row as HTMLElement).queryByText(/công nợ quá hạn/)).not.toBeInTheDocument();
  });

  it("B. vượt = 0 (giữ vì nợ quá hạn) → 'Khách có công nợ quá hạn', KHÔNG 'Vượt hạn mức 0 ₫'", async () => {
    // 200.000 + 350.000 ≤ 1.000.000: không vượt — BE chỉ giữ vì khách có nợ quá hạn (OVERDUE)
    renderList(ORDER_PERMISSION_SETS.accountant, [{ ...hold, exposure: 200_000 }]);

    const row = (await screen.findByText(apiOrder.orderNumber)).closest("tr");
    expect(within(row as HTMLElement).getByText("Khách có công nợ quá hạn")).toBeInTheDocument();
    expect(within(row as HTMLElement).queryByText(/Vượt hạn mức/)).not.toBeInTheDocument();
    expect((row as HTMLElement).textContent).not.toMatch(/Vượt hạn mức\s*0/);
    // A/D. tiêu đề trung tính — không khẳng định đây là lý do giữ BE đã lưu
    expect(screen.getByRole("columnheader", { name: "Tình trạng công nợ" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /Lý do giữ/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Lý do giữ/)).not.toBeInTheDocument();
  });

  it("ACCOUNTANT (APPROVE) thấy Duyệt / Từ chối; mã đơn không là link (không có quyền sales-orders)", async () => {
    renderList(ORDER_PERMISSION_SETS.accountant);

    expect(
      await screen.findByRole("button", { name: /^Duyệt vượt hạn mức đơn/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Từ chối vượt hạn mức đơn/ })).toBeInTheDocument();
    // G. mã đơn vẫn hiện nhưng không là link tới trang đơn bị chặn
    expect(screen.getByText(apiOrder.orderNumber)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: apiOrder.orderNumber })).not.toBeInTheDocument();
    // E. không có link "Đơn hàng" ở header — ACCOUNTANT không vào được trang đơn
    expect(screen.queryByRole("link", { name: /Đơn hàng/ })).not.toBeInTheDocument();
  });

  it("ORDER_COORDINATOR / SALES_STAFF chỉ xem — không có nút duyệt, mã đơn là link", async () => {
    renderList(ORDER_PERMISSION_SETS.coordinator);

    // H. mã đơn là link tới chi tiết
    expect(await screen.findByRole("link", { name: apiOrder.orderNumber })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.orders.detail(apiOrder.orderId),
    );
    expect(screen.queryByRole("button", { name: /Duyệt vượt hạn mức/ })).not.toBeInTheDocument();
    // F. có sales-orders:VIEW_PAGE → link "Đơn hàng" ở header về đúng danh sách đơn
    expect(screen.getByRole("link", { name: /Đơn hàng/ })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.orders.list,
    );
  });

  it("I. chỉ quyền credit hold VIEW_PAGE + READ (không có sales-orders) → vào được hàng đợi", async () => {
    const get = renderList([CREDIT_HOLD_PERMISSIONS.viewPage, CREDIT_HOLD_PERMISSIONS.read]);

    expect(await screen.findByText(apiOrder.orderNumber)).toBeInTheDocument();
    expect(screen.queryByText("Bạn không có quyền")).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === "/orders/credit-holds")).toBe(true);
    expect(screen.queryByRole("link", { name: /Đơn hàng/ })).not.toBeInTheDocument();
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
      expect(post).toHaveBeenCalledWith(
        APPROVE_PATH,
        { note: "Khách đã cam kết" },
        WITH_IDEMPOTENCY_KEY,
      ),
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
    // Điền sẵn % cọc mặc định của khách (credit position) — xoá để nhập giá trị khác
    await user.clear(percent);
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
      expect(post).toHaveBeenCalledWith(
        REJECT_PATH,
        {
          action: "SWITCH_TO_DEPOSIT",
          depositPercent: 30.5,
          note: "Chuyển cọc",
        },
        WITH_IDEMPOTENCY_KEY,
      ),
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

/* ── Step 6: công nợ HIỆN TẠI (GET /orders/credit-position/{customerId}) ── */

const OTHER_CUSTOMER = "7e57c0de-0000-4000-8000-0000000000aa";
const otherHold = {
  ...hold,
  order: {
    ...heldOrder,
    orderId: "2b8c9d0e-1111-4aaa-8bbb-000000000002",
    orderNumber: "SO-20260908-000777",
    customerId: OTHER_CUSTOMER,
  },
};
const restrictedPosition = {
  ...apiCreditPosition,
  customerId: OTHER_CUSTOMER,
  allowedTerms: ["PREPAID", "CREDIT"],
  depositPercent: undefined,
  hasOverdue: true,
};

async function openReject(user: ReturnType<typeof userEvent.setup>, orderNumber: string) {
  await user.click(
    await screen.findByRole("button", { name: `Từ chối vượt hạn mức đơn ${orderNumber}` }),
  );
  return screen.findByRole("dialog");
}

/** Mở Select "Cách xử lý" và trả nhãn các lựa chọn đang có. */
async function refusalOptions(user: ReturnType<typeof userEvent.setup>): Promise<string[]> {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.scrollIntoView ??= () => {};
  await user.click(screen.getByRole("combobox", { name: /Cách xử lý/ }));
  const options = (await screen.findAllByRole("option")).map((o) => o.textContent ?? "");
  await user.keyboard("{Escape}");
  return options;
}

describe("Credit hold — công nợ hiện tại của khách", { timeout: DIALOG_FLOW_TIMEOUT_MS }, () => {
  it("D/E. hàng đợi KHÔNG gọi credit position theo từng dòng; mở dialog mới gọi, đúng 1 lần cho khách đó", async () => {
    const user = userEvent.setup();
    const get = renderList(ORDER_PERMISSION_SETS.accountant, [hold, otherHold], {
      [POSITION_PATH]: () => apiCreditPosition,
      [positionPath(OTHER_CUSTOMER)]: () => restrictedPosition,
    });

    expect(await screen.findByText(otherHold.order.orderNumber)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).includes("credit-position"))).toBe(false);

    await openReject(user, apiOrder.orderNumber);
    await waitFor(() => expect(callsTo(get, POSITION_PATH)).toBe(1));
    expect(callsTo(get, positionPath(OTHER_CUSTOMER))).toBe(0);
  });

  it("D. thiếu customer-credit-profiles:READ → không gọi API, chỉ còn 'Huỷ đơn'", async () => {
    const user = userEvent.setup();
    const get = renderList([
      CREDIT_HOLD_PERMISSIONS.viewPage,
      CREDIT_HOLD_PERMISSIONS.read,
      CREDIT_HOLD_PERMISSIONS.approve,
    ]);
    await openReject(user, apiOrder.orderNumber);

    expect(await refusalOptions(user)).toEqual(["Huỷ đơn"]);
    expect(screen.getByText(/cần xem được hồ sơ công nợ của khách/)).toBeInTheDocument();
    expect(callsTo(get, POSITION_PATH)).toBe(0);
  });

  it("F/G/J/H. chỉ cách xử lý theo allowedTerms của từng khách, nhãn tiếng Việt sẵn có", async () => {
    const user = userEvent.setup();
    renderList(ORDER_PERMISSION_SETS.accountant, [hold, otherHold], {
      [POSITION_PATH]: () => apiCreditPosition,
      [positionPath(OTHER_CUSTOMER)]: () => restrictedPosition,
    });

    await openReject(user, apiOrder.orderNumber);
    await screen.findByRole("region", { name: "Công nợ hiện tại của khách" });
    expect(await refusalOptions(user)).toEqual([
      "Huỷ đơn",
      "Chuyển sang trả trước 100%",
      "Chuyển sang đặt cọc",
    ]);
    await user.click(screen.getByRole("button", { name: "Huỷ" }));

    // Khách khác: hồ sơ không có DEPOSIT → không có "Chuyển sang đặt cọc"
    await openReject(user, otherHold.order.orderNumber);
    await screen.findByText("Hiện có khoản quá hạn");
    expect(await refusalOptions(user)).toEqual(["Huỷ đơn", "Chuyển sang trả trước 100%"]);
  });

  it("I. allowedTerms không có PREPAID / DEPOSIT → chỉ huỷ được, không gửi chuyển phương thức", async () => {
    const user = userEvent.setup();
    renderList(ORDER_PERMISSION_SETS.accountant, [hold], {
      [POSITION_PATH]: () => ({ ...apiCreditPosition, allowedTerms: ["CREDIT", "INSTALLMENT"] }),
    });
    await openReject(user, apiOrder.orderNumber);
    await screen.findByRole("region", { name: "Công nợ hiện tại của khách" });

    // Mã FE chưa biết (INSTALLMENT) không thành lựa chọn
    expect(await refusalOptions(user)).toEqual(["Huỷ đơn"]);
  });

  it("K/L. % cọc điền sẵn từ credit position của đúng khách (40 / 25), không phải số FE tự đặt", async () => {
    const user = userEvent.setup();
    renderList(ORDER_PERMISSION_SETS.accountant, [hold, otherHold], {
      [POSITION_PATH]: () => apiCreditPosition,
      [positionPath(OTHER_CUSTOMER)]: () => ({
        ...restrictedPosition,
        allowedTerms: ["DEPOSIT"],
        depositPercent: 25,
      }),
    });

    for (const [orderNumber, expected] of [
      [apiOrder.orderNumber, "40"],
      [otherHold.order.orderNumber, "25"],
    ] as const) {
      const dialog = await openReject(user, orderNumber);
      await screen.findByRole("region", { name: "Công nợ hiện tại của khách" });
      await pickOrderSelectOption(user, /Cách xử lý/, "Chuyển sang đặt cọc");
      expect(within(dialog).getByLabelText(/Tỷ lệ cọc/)).toHaveValue(Number(expected));
      await user.click(within(dialog).getByRole("button", { name: "Huỷ" }));
    }
  });

  it("M. tải lại nền (focus cửa sổ) không ghi đè % cọc người dùng đã sửa", async () => {
    const user = userEvent.setup();
    let calls = 0;
    const get = renderList(ORDER_PERMISSION_SETS.accountant, [hold], {
      [POSITION_PATH]: () => ({ ...apiCreditPosition, depositPercent: ++calls === 1 ? 40 : 60 }),
    });
    const dialog = await openReject(user, apiOrder.orderNumber);
    await screen.findByRole("region", { name: "Công nợ hiện tại của khách" });
    await pickOrderSelectOption(user, /Cách xử lý/, "Chuyển sang đặt cọc");
    const percent = within(dialog).getByLabelText(/Tỷ lệ cọc/);
    await user.clear(percent);
    await user.type(percent, "35");

    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await waitFor(() => expect(callsTo(get, POSITION_PATH)).toBe(2));
    expect(percent).toHaveValue(35);
    focusManager.setFocused(undefined);
  });

  it("N/O. công nợ hiện tại ghi rõ là HIỆN TẠI; nợ quá hạn hiện tại không đổi tình trạng lúc kiểm ở hàng đợi", async () => {
    const user = userEvent.setup();
    renderList(ORDER_PERMISSION_SETS.accountant, [hold], {
      [POSITION_PATH]: () => ({ ...apiCreditPosition, hasOverdue: true }),
    });
    const row = (await screen.findByText(apiOrder.orderNumber)).closest("tr") as HTMLElement;
    await openReject(user, apiOrder.orderNumber);

    const panel = await screen.findByRole("region", { name: "Công nợ hiện tại của khách" });
    expect(within(panel).getByText("Hiện có khoản quá hạn")).toBeInTheDocument();
    expect(within(panel).getByText(/200\.000/)).toBeInTheDocument();
    // Cột tình trạng của hàng đợi vẫn theo số liệu lúc kiểm (vượt 150.000), không thành "quá hạn"
    expect(within(row).getByText(/^Vượt hạn mức/)).toHaveTextContent(/150\.000/);
    expect(within(row).queryByText("Khách có công nợ quá hạn")).not.toBeInTheDocument();
  });

  it("P. đang tải credit position → chỉ 'Huỷ đơn', không có lựa chọn / % cọc giả", async () => {
    const user = userEvent.setup();
    const get = renderList(ORDER_PERMISSION_SETS.accountant);
    const base = get.getMockImplementation();
    get.mockImplementation((url: string, config?: { params?: unknown }) =>
      url === POSITION_PATH ? new Promise(() => {}) : (base?.(url, config) ?? Promise.reject()),
    );
    await openReject(user, apiOrder.orderNumber);

    expect(
      await screen.findByRole("status", { name: /Đang tải công nợ hiện tại/ }),
    ).toBeInTheDocument();
    expect(await refusalOptions(user)).toEqual(["Huỷ đơn"]);
    expect(screen.queryByLabelText(/Tỷ lệ cọc/)).not.toBeInTheDocument();
  });

  it("Q. tải lỗi → dialog vẫn mở, báo lỗi + Thử lại; vẫn huỷ đơn được", async () => {
    const user = userEvent.setup();
    let fail = true;
    const get = renderList(ORDER_PERMISSION_SETS.accountant, [hold], {
      [POSITION_PATH]: () => {
        if (fail) throw new ApiError(503, "SERVICE_UNAVAILABLE", "down");
        return apiCreditPosition;
      },
    });
    const post = vi.spyOn(api, "post").mockResolvedValue({
      data: { ...heldOrder, status: "CANCELLED" },
    });
    const dialog = await openReject(user, apiOrder.orderNumber);

    expect(await within(dialog).findByText(/Không tải được công nợ hiện tại/)).toBeInTheDocument();
    expect(await refusalOptions(user)).toEqual(["Huỷ đơn"]);

    fail = false;
    await user.click(within(dialog).getByRole("button", { name: "Thử lại" }));
    await screen.findByRole("region", { name: "Công nợ hiện tại của khách" });
    expect(callsTo(get, POSITION_PATH)).toBeGreaterThanOrEqual(2);

    await pickOrderSelectOption(user, /Cách xử lý/, "Huỷ đơn");
    await user.type(within(dialog).getByLabelText(/Ghi chú/), "Huỷ");
    await user.click(within(dialog).getByRole("button", { name: "Từ chối" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        REJECT_PATH,
        { action: "CANCEL", note: "Huỷ" },
        WITH_IDEMPOTENCY_KEY,
      ),
    );
  });

  it("R. PAYMENT_TERM_NOT_ALLOWED → lỗi ở 'Cách xử lý', không báo thành công, tải lại công nợ và bỏ lựa chọn không còn được phép", async () => {
    const user = userEvent.setup();
    let calls = 0;
    const get = renderList(ORDER_PERMISSION_SETS.accountant, [hold], {
      [POSITION_PATH]: () =>
        ++calls === 1 ? apiCreditPosition : { ...apiCreditPosition, allowedTerms: ["PREPAID"] },
    });
    vi.spyOn(api, "post").mockRejectedValue(new ApiError(409, "PAYMENT_TERM_NOT_ALLOWED", "x"));
    const dialog = await openReject(user, apiOrder.orderNumber);
    await screen.findByRole("region", { name: "Công nợ hiện tại của khách" });
    await pickOrderSelectOption(user, /Cách xử lý/, "Chuyển sang đặt cọc");
    await user.type(within(dialog).getByLabelText(/Ghi chú/), "Cọc");
    await user.click(within(dialog).getByRole("button", { name: "Từ chối" }));

    expect(
      await within(dialog).findByText(/không còn được dùng phương thức này/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: /Cách xử lý/ })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.queryByText("Đã từ chối vượt hạn mức công nợ")).not.toBeInTheDocument();
    await waitFor(() => expect(callsTo(get, POSITION_PATH)).toBe(2));
    await waitFor(() =>
      expect(within(dialog).queryByLabelText(/Tỷ lệ cọc/)).not.toBeInTheDocument(),
    );
    expect(await refusalOptions(user)).toEqual(["Huỷ đơn", "Chuyển sang trả trước 100%"]);
  });

  it("S. lỗi khác (500) giữ hành vi cũ — không tải lại công nợ, không gắn lỗi vào 'Cách xử lý'", async () => {
    const user = userEvent.setup();
    const get = renderList(ORDER_PERMISSION_SETS.accountant);
    vi.spyOn(api, "post").mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "boom"));
    const dialog = await openReject(user, apiOrder.orderNumber);
    await screen.findByRole("region", { name: "Công nợ hiện tại của khách" });
    await pickOrderSelectOption(user, /Cách xử lý/, "Huỷ đơn");
    await user.type(within(dialog).getByLabelText(/Ghi chú/), "Huỷ");
    await user.click(within(dialog).getByRole("button", { name: "Từ chối" }));

    expect(await within(dialog).findByText(/Đã xảy ra lỗi khi xử lý đơn/)).toBeInTheDocument();
    expect(
      within(dialog).queryByText(/không còn được dùng phương thức này/),
    ).not.toBeInTheDocument();
    expect(callsTo(get, POSITION_PATH)).toBe(1);
  });

  it("duyệt không phụ thuộc credit position: tải lỗi vẫn duyệt được (BE chỉ nhận ghi chú)", async () => {
    const user = userEvent.setup();
    renderList(ORDER_PERMISSION_SETS.accountant, [hold], {
      [POSITION_PATH]: () => {
        throw new ApiError(503, "SERVICE_UNAVAILABLE", "down");
      },
    });
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: { ...heldOrder, status: "CONFIRMED" } });
    await user.click(await screen.findByRole("button", { name: /^Duyệt vượt hạn mức đơn/ }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/Không tải được công nợ hiện tại/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Ghi chú duyệt/), "Ok");
    await user.click(within(dialog).getByRole("button", { name: "Duyệt" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(APPROVE_PATH, { note: "Ok" }, WITH_IDEMPOTENCY_KEY),
    );
  });
});

/* ── Step 8: tranh chấp đồng thời + fieldErrors BE ─────────────────────── */

describe(
  "Credit hold — OPTIMISTIC_LOCK / LOCK_TIMEOUT / fieldErrors",
  { timeout: DIALOG_FLOW_TIMEOUT_MS },
  () => {
    async function fillCancel(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
      await screen.findByRole("region", { name: "Công nợ hiện tại của khách" });
      await pickOrderSelectOption(user, /Cách xử lý/, "Huỷ đơn");
      await user.type(within(dialog).getByLabelText(/Ghi chú/), "Huỷ");
      await user.click(within(dialog).getByRole("button", { name: "Từ chối" }));
    }

    it("A. OPTIMISTIC_LOCK khi từ chối → báo + giữ dialog/ghi chú, tải lại hàng đợi + công nợ, không tự gửi lại", async () => {
      const user = userEvent.setup();
      const get = renderList(ORDER_PERMISSION_SETS.accountant);
      const post = vi
        .spyOn(api, "post")
        .mockRejectedValueOnce(new ApiError(409, "OPTIMISTIC_LOCK", "changed"))
        .mockResolvedValueOnce({ data: { ...heldOrder, status: "CANCELLED" } });
      const dialog = await openReject(user, apiOrder.orderNumber);
      const queueBefore = callsTo(get, "/orders/credit-holds");

      await fillCancel(user, dialog);
      expect(await within(dialog).findByText(/vừa được người khác cập nhật/)).toBeInTheDocument();
      await waitFor(() =>
        expect(callsTo(get, "/orders/credit-holds")).toBeGreaterThan(queueBefore),
      );
      await waitFor(() => expect(callsTo(get, POSITION_PATH)).toBe(2));
      expect(post).toHaveBeenCalledTimes(1);
      expect(within(dialog).getByLabelText(/Ghi chú/)).toHaveValue("Huỷ");
      // Lỗi khoá không gắn vào ô nào
      expect(within(dialog).getByRole("combobox", { name: /Cách xử lý/ })).not.toHaveAttribute(
        "aria-invalid",
      );

      await user.click(within(dialog).getByRole("button", { name: "Từ chối" }));
      await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    });

    it("B. LOCK_TIMEOUT khi từ chối → báo thử lại sau, không tải lại hàng đợi / công nợ, không tự gửi lại", async () => {
      const user = userEvent.setup();
      const get = renderList(ORDER_PERMISSION_SETS.accountant);
      const post = vi
        .spyOn(api, "post")
        .mockRejectedValue(new ApiError(409, "LOCK_TIMEOUT", "busy"));
      const dialog = await openReject(user, apiOrder.orderNumber);
      await fillCancel(user, dialog);

      expect(await within(dialog).findByText(/đang được xử lý ở nơi khác/)).toBeInTheDocument();
      const queue = callsTo(get, "/orders/credit-holds");
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(callsTo(get, "/orders/credit-holds")).toBe(queue);
      expect(callsTo(get, POSITION_PATH)).toBe(1);
      expect(post).toHaveBeenCalledTimes(1);
      expect(within(dialog).getByRole("button", { name: "Từ chối" })).toBeEnabled();
    });

    it("fieldErrors note + depositPercent → lỗi tại cả hai ô; field cấp lớp lạ → thông báo chung; sửa ô → hết lỗi, gửi lại được", async () => {
      const user = userEvent.setup();
      renderList(ORDER_PERMISSION_SETS.accountant);
      const post = vi
        .spyOn(api, "post")
        .mockRejectedValueOnce(
          new ApiError(400, "VALIDATION_FAILED", "Invalid request data", {
            note: "note is required",
            depositPercent: "depositPercent must be below 100",
            creditRefusalRequest: "object-level problem",
          }),
        )
        .mockResolvedValueOnce({ data: { ...heldOrder, status: "PENDING_PAYMENT" } });
      const dialog = await openReject(user, apiOrder.orderNumber);
      await screen.findByRole("region", { name: "Công nợ hiện tại của khách" });
      await pickOrderSelectOption(user, /Cách xử lý/, "Chuyển sang đặt cọc");
      await user.type(within(dialog).getByLabelText(/Ghi chú/), "Cọc");
      await user.click(within(dialog).getByRole("button", { name: "Từ chối" }));

      expect(await within(dialog).findByText(/Ghi chú là bắt buộc/)).toBeInTheDocument();
      expect(
        within(dialog).getByText(/Tỷ lệ cọc phải lớn hơn 0% và nhỏ hơn 100%\./),
      ).toBeInTheDocument();
      expect(within(dialog).getByLabelText(/Tỷ lệ cọc/)).toHaveAttribute("aria-invalid", "true");
      expect(within(dialog).getByText("object-level problem")).toBeInTheDocument();

      // F. sửa ô → lỗi máy chủ của ô đó mất, form chạy bình thường
      await user.type(within(dialog).getByLabelText(/Ghi chú/), " lại");
      await waitFor(() =>
        expect(within(dialog).queryByText(/Ghi chú là bắt buộc/)).not.toBeInTheDocument(),
      );
      const percent = within(dialog).getByLabelText(/Tỷ lệ cọc/);
      await user.clear(percent);
      await user.type(percent, "35");
      await user.click(within(dialog).getByRole("button", { name: "Từ chối" }));
      await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
      expect(post).toHaveBeenLastCalledWith(
        REJECT_PATH,
        {
          action: "SWITCH_TO_DEPOSIT",
          depositPercent: 35,
          note: "Cọc lại",
        },
        WITH_IDEMPOTENCY_KEY,
      );
    });

    it("E. kiểm tra phía client (zod) vẫn chạy: ghi chú trống → không gửi", async () => {
      const user = userEvent.setup();
      renderList(ORDER_PERMISSION_SETS.accountant);
      const post = vi.spyOn(api, "post");
      const dialog = await openReject(user, apiOrder.orderNumber);
      await screen.findByRole("region", { name: "Công nợ hiện tại của khách" });
      await pickOrderSelectOption(user, /Cách xử lý/, "Huỷ đơn");
      expect(within(dialog).getByRole("button", { name: "Từ chối" })).toBeDisabled();
      expect(post).not.toHaveBeenCalled();
    });

    it("duyệt: fieldErrors.note → lỗi tại ô ghi chú duyệt", async () => {
      const user = userEvent.setup();
      renderList(ORDER_PERMISSION_SETS.accountant);
      vi.spyOn(api, "post").mockRejectedValue(
        new ApiError(400, "VALIDATION_FAILED", "Invalid request data", {
          note: "note is required",
        }),
      );
      await user.click(await screen.findByRole("button", { name: /^Duyệt vượt hạn mức đơn/ }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/Ghi chú duyệt/), "Ok");
      await user.click(within(dialog).getByRole("button", { name: "Duyệt" }));

      expect(await within(dialog).findByText(/Ghi chú là bắt buộc/)).toBeInTheDocument();
      expect(within(dialog).getByLabelText(/Ghi chú duyệt/)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    });
  },
);

/* ── Step 9: Idempotency-Key ───────────────────────────────────────────── */

describe("Credit hold — Idempotency-Key", { timeout: DIALOG_FLOW_TIMEOUT_MS }, () => {
  type PostSpy = { mock: { calls: unknown[][] } };
  const keyOf = (post: PostSpy, call: number) =>
    (post.mock.calls[call]?.[2] as { headers?: Record<string, string> } | undefined)?.headers?.[
      "Idempotency-Key"
    ];

  async function rejectCancel(user: ReturnType<typeof userEvent.setup>, note: string) {
    const dialog = await openReject(user, apiOrder.orderNumber);
    await screen.findByRole("region", { name: "Công nợ hiện tại của khách" });
    await pickOrderSelectOption(user, /Cách xử lý/, "Huỷ đơn");
    await user.type(within(dialog).getByLabelText(/Ghi chú/), note);
    await user.click(within(dialog).getByRole("button", { name: "Từ chối" }));
    return dialog;
  }

  it("C. đổi nội dung sau lỗi tạm thời → key mới; một key không bao giờ đi với hai body khác nhau", async () => {
    const user = userEvent.setup();
    renderList(ORDER_PERMISSION_SETS.accountant);
    const post = vi
      .spyOn(api, "post")
      .mockRejectedValueOnce(new ApiError(409, "LOCK_TIMEOUT", "busy"))
      .mockResolvedValueOnce({ data: { ...heldOrder, status: "CANCELLED" } });
    const dialog = await rejectCancel(user, "A");
    await within(dialog).findByText(/đang được xử lý ở nơi khác/);

    await user.type(within(dialog).getByLabelText(/Ghi chú/), "B");
    await user.click(within(dialog).getByRole("button", { name: "Từ chối" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls.map((c) => c[1])).toEqual([
      { action: "CANCEL", note: "A" },
      { action: "CANCEL", note: "AB" },
    ]);
    expect(keyOf(post, 1)).not.toBe(keyOf(post, 0));
  });

  it("IDEMPOTENT_REQUEST_IN_PROGRESS (409) → báo đang xử lý, không tự gửi lại; bấm lại dùng CÙNG key", async () => {
    const user = userEvent.setup();
    renderList(ORDER_PERMISSION_SETS.accountant);
    const post = vi
      .spyOn(api, "post")
      .mockRejectedValueOnce(new ApiError(409, "IDEMPOTENT_REQUEST_IN_PROGRESS", "still running"))
      .mockResolvedValueOnce({ data: { ...heldOrder, status: "CANCELLED" } });
    const dialog = await rejectCancel(user, "Huỷ");

    expect(await within(dialog).findByText(/vẫn đang được máy chủ xử lý/)).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    await user.click(within(dialog).getByRole("button", { name: "Từ chối" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(keyOf(post, 1)).toBe(keyOf(post, 0));
  });

  it("IDEMPOTENCY_KEY_REUSED (422) → báo ở mức dialog, không gắn vào ô, không tự gửi lại; bấm lại dùng key MỚI", async () => {
    const user = userEvent.setup();
    renderList(ORDER_PERMISSION_SETS.accountant);
    const post = vi
      .spyOn(api, "post")
      .mockRejectedValueOnce(new ApiError(422, "IDEMPOTENCY_KEY_REUSED", "reused"))
      .mockResolvedValueOnce({ data: { ...heldOrder, status: "CANCELLED" } });
    const dialog = await rejectCancel(user, "Huỷ");

    expect(await within(dialog).findByText(/trùng mã với yêu cầu trước/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Ghi chú/)).not.toHaveAttribute("aria-invalid");
    expect(within(dialog).getByRole("combobox", { name: /Cách xử lý/ })).not.toHaveAttribute(
      "aria-invalid",
    );
    expect(post).toHaveBeenCalledTimes(1);
    await user.click(within(dialog).getByRole("button", { name: "Từ chối" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(keyOf(post, 1)).not.toBe(keyOf(post, 0));
  });

  it("D. duyệt và từ chối cùng đơn: mỗi dialog một key, không rò key sang nhau", async () => {
    const user = userEvent.setup();
    renderList(ORDER_PERMISSION_SETS.accountant);
    const post = vi.spyOn(api, "post").mockRejectedValue(new ApiError(409, "LOCK_TIMEOUT", "busy"));
    const rejectDialog = await rejectCancel(user, "Huỷ");
    await within(rejectDialog).findByText(/đang được xử lý ở nơi khác/);
    await user.click(within(rejectDialog).getByRole("button", { name: "Huỷ" }));

    await user.click(await screen.findByRole("button", { name: /^Duyệt vượt hạn mức đơn/ }));
    const approve = await screen.findByRole("dialog");
    await user.type(within(approve).getByLabelText(/Ghi chú duyệt/), "Ok");
    await user.click(within(approve).getByRole("button", { name: "Duyệt" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1]?.[0]).toBe(APPROVE_PATH);
    expect(keyOf(post, 1)).not.toBe(keyOf(post, 0));
  });

  it("G. OPTIMISTIC_LOCK → tải lại thấy đơn không còn chờ duyệt → dialog biến mất, không tự gửi", async () => {
    const user = userEvent.setup();
    let queue: unknown[] = [hold];
    renderList(ORDER_PERMISSION_SETS.accountant, [], {
      [POSITION_PATH]: () => apiCreditPosition,
    });
    // Hàng đợi động: sau lỗi khoá, người khác đã xử lý đơn → hàng đợi rỗng
    const get = vi.mocked(api.get);
    const base = get.getMockImplementation();
    get.mockImplementation((url: string, config?: { params?: unknown }) =>
      url === "/orders/credit-holds"
        ? Promise.resolve({ data: apiOrderPage(queue as never[]) })
        : (base?.(url, config) ?? Promise.reject(new Error(url))),
    );
    const post = vi.spyOn(api, "post").mockImplementation(async () => {
      queue = [];
      throw new ApiError(409, "OPTIMISTIC_LOCK", "changed");
    });
    await rejectCancel(user, "Huỷ");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Không có đơn vượt hạn mức")).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });
});
