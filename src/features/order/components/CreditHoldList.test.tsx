import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_ROUTES,
  CREDIT_HOLD_PERMISSIONS,
  CREDIT_PROFILE_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
} from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { apiCreditPosition, apiOrder, apiOrderPage } from "../__fixtures__/order";
import { ORDER_PERMISSION_SETS, mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { CreditHoldList } from "./credit-hold/CreditHoldList";

import type { PermissionCode } from "@/lib/auth";
import type { RouteHandler } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

// BE CreditHoldResponse.order (staff) luôn mang holdReason CREDIT cho đơn vượt hạn mức (PR #133). Từ 4B-10 BE không
// còn gửi `paymentTerm` / `paymentStatus` (TT-1) — fixture bỏ hẳn hai field để nút duyệt không phụ thuộc chúng.
const heldOrder = {
  ...apiOrder,
  status: "ON_HOLD" as const,
  paymentTerm: undefined,
  paymentStatus: undefined,
  holdReason: "CREDIT" as const,
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

  it("kế toán thấy tên + mã khách BE kèm sẵn, không UUID (QA A5, BE-15)", async () => {
    renderList(ORDER_PERMISSION_SETS.accountant, [
      {
        ...hold,
        order: { ...heldOrder, customerName: "Công ty Bao Bì An Phát", customerCode: "0312345678" },
      },
    ]);

    const row = (await screen.findByText(apiOrder.orderNumber)).closest("tr") as HTMLElement;
    expect(within(row).getByText("Công ty Bao Bì An Phát")).toBeInTheDocument();
    expect(within(row).getByText("0312345678")).toBeInTheDocument();
    expect(within(row).queryByText(apiOrder.customerId as string)).not.toBeInTheDocument();
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

    expect(await screen.findByRole("button", { name: /^Duyệt công nợ đơn/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Từ chối duyệt công nợ đơn/ })).toBeInTheDocument();
    // G. mã đơn vẫn hiện nhưng không là link tới trang đơn bị chặn
    expect(screen.getByText(apiOrder.orderNumber)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: apiOrder.orderNumber })).not.toBeInTheDocument();
    // E. không có link "Đơn hàng" ở header — ACCOUNTANT không vào được trang đơn
    expect(screen.queryByRole("link", { name: /Đơn hàng/ })).not.toBeInTheDocument();
  });

  it("AUTH-6: người duyệt hạn mức (xem khách + APPROVE hồ sơ công nợ) có lối tắt sửa hạn mức của khách", async () => {
    // Kế toán đã xem được trang khách (BE V20261227000400) — chỉ thêm APPROVE hồ sơ công nợ
    renderList([...ORDER_PERMISSION_SETS.accountant, CREDIT_PROFILE_PERMISSIONS.approve]);

    expect(await screen.findByRole("link", { name: "Sửa hạn mức công nợ" })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.customers.creditProfile(
        apiOrder.customerId as string,
        ADMIN_ROUTES.orders.creditHolds,
      ),
    );
  });

  it.each([
    [
      "thiếu quyền xem trang khách",
      [
        ...ORDER_PERMISSION_SETS.accountant.filter((code) => code !== CUSTOMER_PERMISSIONS.viewPage),
        CREDIT_PROFILE_PERMISSIONS.approve,
      ],
    ],
    ["thiếu APPROVE hồ sơ công nợ", ORDER_PERMISSION_SETS.accountant],
  ])("AUTH-6: %s → không có lối tắt", async (_case, permissions) => {
    renderList(permissions);
    await screen.findByText(apiOrder.orderNumber);
    expect(screen.queryByRole("link", { name: "Sửa hạn mức công nợ" })).not.toBeInTheDocument();
  });

  it("ORDER_COORDINATOR / SALES_STAFF chỉ xem — không có nút duyệt, mã đơn là link", async () => {
    renderList(ORDER_PERMISSION_SETS.coordinator);

    // H. mã đơn là link tới chi tiết
    expect(await screen.findByRole("link", { name: apiOrder.orderNumber })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.orders.detail(apiOrder.orderId),
    );
    expect(screen.queryByRole("button", { name: /Duyệt công nợ/ })).not.toBeInTheDocument();
    // F. trang danh sách kiểu Vercel: không tiêu đề / nút "← Đơn hàng" — breadcrumb và sidebar dẫn về đơn (BO-UX-2)
    expect(screen.queryByRole("link", { name: /Đơn hàng/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Đơn chờ duyệt công nợ" })).toHaveClass(
      "sr-only",
    );
  });

  it("BO-UX-32: dòng giữ vì nợ quá hạn có số quá hạn hiện tại + số ngày; cột Chờ duyệt; thao tác ghim phải", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-12T03:00:00Z") });
    try {
      renderList(ORDER_PERMISSION_SETS.accountant, [{ ...hold, exposure: 200_000 }], {
        [POSITION_PATH]: () => ({
          ...apiCreditPosition,
          hasOverdue: true,
          overdueAmount: 41_195_000,
          oldestOverdueDueDate: "2026-11-02",
        }),
      });
      const row = (await screen.findByText(apiOrder.orderNumber)).closest("tr") as HTMLElement;
      expect(await within(row).findByText(/41\.195\.000/)).toBeInTheDocument();
      expect(within(row).getByText("quá hạn 10 ngày")).toBeInTheDocument();
      // checkedAt 2026-09-07 → 66 ngày chờ
      expect(within(row).getByText("66 ngày")).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Quá hạn hiện tại" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Thao tác" }).className).toContain("sticky");
    } finally {
      vi.useRealTimers();
    }
  });

  it("không có tên / mã khách → nhãn trung tính, không hiện mảnh UUID 'KH …' (BO-UX-6)", async () => {
    renderList(ORDER_PERMISSION_SETS.accountant, [
      {
        ...hold,
        order: {
          ...heldOrder,
          customerName: undefined,
          customerCode: undefined,
          shippingAddress: { ...heldOrder.shippingAddress, recipientName: "" },
        },
      },
    ]);
    const row = (await screen.findByText(apiOrder.orderNumber)).closest("tr") as HTMLElement;
    expect(within(row).getByText("Khách hàng")).toBeInTheDocument();
    expect(row.textContent).not.toMatch(/KH [0-9a-f]{8}/);
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
    expect(await screen.findByText("Không có đơn chờ duyệt công nợ")).toBeInTheDocument();
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

    await user.click(await screen.findByRole("button", { name: /^Duyệt công nợ đơn/ }));
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

  it("Credit: từ chối gửi đúng {note}; hộp thoại nói rõ đơn bị huỷ và tiền đã thu thành số phải hoàn", async () => {
    const user = userEvent.setup();
    renderList([...ORDER_PERMISSION_SETS.accountant, "payment-refunds:READ"], [hold], {
      [POSITION_PATH]: () => apiCreditPosition,
      [`/refunds/orders/${apiOrder.orderId}`]: () => ({
        orderId: apiOrder.orderId,
        orderNumber: apiOrder.orderNumber,
        currency: "VND",
        refundStatus: "PENDING",
        refundable: 23_328_000,
        refunded: 0,
        remaining: 23_328_000,
      }),
    });
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: { ...heldOrder, status: "CANCELLED" } });

    await user.click(await screen.findByRole("button", { name: /^Từ chối duyệt công nợ đơn/ }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/sẽ bị huỷ\. Tiền đã thu \(nếu có\) chuyển thành số tiền phải hoàn/),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("combobox", { name: /Cách xử lý/ })).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Ghi chú/), " Quá hạn lâu ");
    await user.click(within(dialog).getByRole("button", { name: "Từ chối và huỷ đơn" }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(REJECT_PATH, { note: "Quá hạn lâu" }, WITH_IDEMPOTENCY_KEY),
    );
    expect(await screen.findAllByText(/Phải hoàn:/)).not.toHaveLength(0);
    expect(screen.getAllByText(/23\.328\.000/)).not.toHaveLength(0);
  });

  it("ORDER_NOT_ON_CREDIT_HOLD (người khác đã xử lý) → đóng dialog, tải lại danh sách", async () => {
    const user = userEvent.setup();
    const get = renderList(ORDER_PERMISSION_SETS.accountant);
    vi.spyOn(api, "post").mockRejectedValue(new ApiError(409, "ORDER_NOT_ON_CREDIT_HOLD", "x"));

    await user.click(await screen.findByRole("button", { name: /^Duyệt công nợ đơn/ }));
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

/* ── Vị thế tín dụng (GET /orders/credit-position/{customerId}, BE CreditPositionResponse) ── */

async function openReject(user: ReturnType<typeof userEvent.setup>, orderNumber: string) {
  await user.click(
    await screen.findByRole("button", { name: `Từ chối duyệt công nợ đơn ${orderNumber}` }),
  );
  return screen.findByRole("dialog");
}

describe("Credit hold — vị thế tín dụng của khách", { timeout: DIALOG_FLOW_TIMEOUT_MS }, () => {
  it("Credit: hàng đợi không gọi theo từng dòng; mở dialog → panel parse đúng hạn mức, dư nợ, quá hạn", async () => {
    const user = userEvent.setup();
    const get = renderList(ORDER_PERMISSION_SETS.accountant, [hold], {
      [POSITION_PATH]: () => ({
        ...apiCreditPosition,
        creditLimit: 300_000_000,
        creditTermDays: 15,
        exposure: 50_000_000,
        availableCredit: 250_000_000,
        hasOverdue: true,
        overdueAmount: 41_195_000,
        oldestOverdueDueDate: "2026-11-02",
      }),
    });
    await screen.findByText(apiOrder.orderNumber);
    expect(callsTo(get, POSITION_PATH)).toBe(0);
    const dialog = await openReject(user, apiOrder.orderNumber);
    const panel = await within(dialog).findByRole("region", { name: "Vị thế tín dụng của khách" });
    expect(panel).toHaveTextContent(/300\.000\.000/);
    expect(panel).toHaveTextContent(/Có quá hạn: 41\.195\.000/);
    expect(panel).toHaveTextContent(/cũ nhất từ ngày 2 thg 11, 2026/);
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
    await user.click(await screen.findByRole("button", { name: /^Duyệt công nợ đơn/ }));
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText(/Không tải được công nợ hiện tại của khách/),
    ).toBeInTheDocument();
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
      await user.type(within(dialog).getByLabelText(/Ghi chú/), "Huỷ");
      await user.click(within(dialog).getByRole("button", { name: "Từ chối và huỷ đơn" }));
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

      await user.click(within(dialog).getByRole("button", { name: "Từ chối và huỷ đơn" }));
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
      expect(within(dialog).getByRole("button", { name: "Từ chối và huỷ đơn" })).toBeEnabled();
    });

    it("fieldErrors note → lỗi tại ô; field cấp lớp lạ → thông báo chung; sửa ô → gửi lại được", async () => {
      const user = userEvent.setup();
      renderList(ORDER_PERMISSION_SETS.accountant);
      const post = vi
        .spyOn(api, "post")
        .mockRejectedValueOnce(
          new ApiError(400, "VALIDATION_FAILED", "Invalid request data", {
            note: "note is required",
            creditRefusalRequest: "object-level problem",
          }),
        )
        .mockResolvedValueOnce({ data: { ...heldOrder, status: "CANCELLED" } });
      const dialog = await openReject(user, apiOrder.orderNumber);
      await user.type(within(dialog).getByLabelText(/Ghi chú/), "Huỷ");
      await user.click(within(dialog).getByRole("button", { name: "Từ chối và huỷ đơn" }));

      expect(await within(dialog).findByText(/Ghi chú là bắt buộc/)).toBeInTheDocument();
      expect(within(dialog).getByText("object-level problem")).toBeInTheDocument();
      await user.type(within(dialog).getByLabelText(/Ghi chú/), " lại");
      await waitFor(() =>
        expect(within(dialog).queryByText(/Ghi chú là bắt buộc/)).not.toBeInTheDocument(),
      );
      await user.click(within(dialog).getByRole("button", { name: "Từ chối và huỷ đơn" }));
      await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
      expect(post).toHaveBeenLastCalledWith(REJECT_PATH, { note: "Huỷ lại" }, WITH_IDEMPOTENCY_KEY);
    });

    it("E. kiểm tra phía client (zod) vẫn chạy: ghi chú trống → không gửi", async () => {
      const user = userEvent.setup();
      renderList(ORDER_PERMISSION_SETS.accountant);
      const post = vi.spyOn(api, "post");
      const dialog = await openReject(user, apiOrder.orderNumber);
      expect(within(dialog).getByRole("button", { name: "Từ chối và huỷ đơn" })).toBeDisabled();
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
      await user.click(await screen.findByRole("button", { name: /^Duyệt công nợ đơn/ }));
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
    await screen.findByRole("region", { name: "Vị thế tín dụng của khách" });
    await user.type(within(dialog).getByLabelText(/Ghi chú/), note);
    await user.click(within(dialog).getByRole("button", { name: "Từ chối và huỷ đơn" }));
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
    await user.click(within(dialog).getByRole("button", { name: "Từ chối và huỷ đơn" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls.map((c) => c[1])).toEqual([{ note: "A" }, { note: "AB" }]);
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
    await user.click(within(dialog).getByRole("button", { name: "Từ chối và huỷ đơn" }));
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
    expect(post).toHaveBeenCalledTimes(1);
    await user.click(within(dialog).getByRole("button", { name: "Từ chối và huỷ đơn" }));
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

    await user.click(await screen.findByRole("button", { name: /^Duyệt công nợ đơn/ }));
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
    expect(await screen.findByText("Không có đơn chờ duyệt công nợ")).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });
});
