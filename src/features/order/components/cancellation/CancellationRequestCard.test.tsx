/**
 * Thẻ "Yêu cầu huỷ của khách" trên chi tiết đơn (docs 17 §4.8 bước 28–31, §5.4): action-gating theo trạng thái yêu cầu +
 * mã quyền BE, duyệt / từ chối kèm payload đúng hợp đồng, phí giữ lại, lý do BE từ chối bằng tiếng Việt, kết quả tất toán.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import {
  REFUND_PATH,
  REQUEST_ID,
  REQUESTS_PATH,
  WF4_PERMISSION_SETS,
  apiCancellationRequest,
  apiRefund,
  callsTo,
  renderWf4Detail,
  requestPage,
} from "../../__fixtures__/wf4";
import { apiOrder, apiOrderAt } from "../../__fixtures__/order";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const APPROVAL_PATH = `/orders/${apiOrder.orderId}/cancellation-requests/${REQUEST_ID}/approval`;
const REJECTION_PATH = `/orders/${apiOrder.orderId}/cancellation-requests/${REQUEST_ID}/rejection`;
const KEY = { headers: { "Idempotency-Key": expect.stringMatching(/^[0-9a-f-]{36}$/) } };
const apiError = (status: number, code: string) =>
  new ApiError(status, code, "English server message", undefined, "trace-1");

async function renderWithPending(
  permissions: readonly PermissionCode[] = WF4_PERMISSION_SETS.sales,
) {
  const spy = await renderWf4Detail(permissions, {
    [REQUESTS_PATH]: () => requestPage([apiCancellationRequest()]),
  });
  return { spy, user: userEvent.setup() };
}

describe("Yêu cầu huỷ — action-gating theo mã quyền BE (≥ 3 vai)", () => {
  it("Sale (sales-order-cancellations:READ + :UPDATE) thấy yêu cầu đang chờ với nút Duyệt huỷ + Từ chối", async () => {
    await renderWithPending();
    const card = await screen.findByRole("region", { name: "Yêu cầu huỷ của khách" });
    expect(within(card).getByText("Chờ xử lý")).toBeInTheDocument(); // Pending
    expect(within(card).getByText("Khách yêu cầu")).toBeInTheDocument();
    expect(within(card).getByText(/Khách hoãn dự án/)).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Duyệt huỷ" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Từ chối" })).toBeInTheDocument();
  });

  it("chỉ đọc hàng đợi (…:READ, không …:UPDATE) → thấy yêu cầu nhưng KHÔNG có nút quyết định", async () => {
    await renderWithPending(WF4_PERMISSION_SETS.salesReadOnly);
    const card = await screen.findByRole("region", { name: "Yêu cầu huỷ của khách" });
    expect(within(card).getByText("Chờ xử lý")).toBeInTheDocument();
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
  });

  it("Kế toán / quản lý kho (không có sales-order-cancellations:READ) → không hiện thẻ và KHÔNG gọi API hàng đợi", async () => {
    for (const permissions of [
      WF4_PERMISSION_SETS.accountant,
      WF4_PERMISSION_SETS.warehouseManager,
    ]) {
      const { spy } = await renderWithPending(permissions);
      await screen.findByRole("heading", { name: apiOrder.orderNumber });
      expect(
        screen.queryByRole("region", { name: "Yêu cầu huỷ của khách" }),
      ).not.toBeInTheDocument();
      expect(callsTo(spy, REQUESTS_PATH)).toBe(0);
      vi.restoreAllMocks();
      document.body.innerHTML = "";
    }
  });

  it("trạng thái cuối (Approved / Rejected / Expired) → không còn nút mutating nào, hiện ghi chú quyết định", async () => {
    await renderWf4Detail(WF4_PERMISSION_SETS.sales, {
      [REQUESTS_PATH]: () =>
        requestPage([
          apiCancellationRequest({
            requestId: "r-exp",
            status: "EXPIRED",
            decisionNote: "Order was packed",
          }),
          apiCancellationRequest({
            requestId: "r-rej",
            status: "REJECTED",
            decisionNote: "Đã in rồi",
          }),
          apiCancellationRequest({
            requestId: "r-ok",
            status: "APPROVED",
            retainedPercent: 30,
            decisionNote: "Đồng ý",
          }),
        ]),
      [REFUND_PATH]: () => apiRefund(),
    });
    const card = await screen.findByRole("region", { name: "Yêu cầu huỷ của khách" });
    expect(within(card).getByText("Hết hiệu lực")).toBeInTheDocument();
    expect(within(card).getByText("Từ chối")).toBeInTheDocument();
    expect(within(card).getByText("Đã duyệt")).toBeInTheDocument();
    expect(within(card).getByText(/Đã in rồi/)).toBeInTheDocument();
    expect(within(card).getByText("Giữ 30% số tiền đã thu")).toBeInTheDocument();
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
  });

  it("đơn chưa có yêu cầu huỷ nào → không chiếm chỗ (không hiện thẻ)", async () => {
    await renderWf4Detail(WF4_PERMISSION_SETS.sales, { [REQUESTS_PATH]: () => requestPage([]) });
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(REQUESTS_PATH, expect.anything()));
    expect(screen.queryByRole("region", { name: "Yêu cầu huỷ của khách" })).not.toBeInTheDocument();
  });

  it("chỉ lấy yêu cầu của chính đơn này (orderId trong query)", async () => {
    const { spy } = await renderWithPending();
    await screen.findByRole("region", { name: "Yêu cầu huỷ của khách" });
    const params = spy.mock.calls.find((c) => c[0] === REQUESTS_PATH)?.[1] as {
      params: URLSearchParams;
    };
    expect(params.params.get("orderId")).toBe(apiOrder.orderId);
  });
});

describe("Duyệt yêu cầu huỷ — payload đúng ApproveCancellationRequest", () => {
  async function openApprove() {
    const { user } = await renderWithPending();
    await user.click(await screen.findByRole("button", { name: "Duyệt huỷ" }));
    return { user, dialog: await screen.findByRole("dialog") };
  }

  it("không phí (mặc định, hoàn toàn bộ) → body rỗng + Idempotency-Key, đóng hộp thoại", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiOrderAt("CANCELLED") });
    const { user, dialog } = await openApprove();
    expect(
      within(dialog).getByRole("radio", { name: "Không giữ phí — hoàn toàn bộ" }),
    ).toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "Duyệt và huỷ đơn" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(APPROVAL_PATH, {}, KEY));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("ghi chú quyết định được gửi, đã trim", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiOrderAt("CANCELLED") });
    const { user, dialog } = await openApprove();
    await user.type(
      within(dialog).getByRole("textbox", { name: /Ghi chú quyết định/ }),
      "  Đồng ý huỷ  ",
    );
    await user.click(within(dialog).getByRole("button", { name: "Duyệt và huỷ đơn" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(APPROVAL_PATH, { note: "Đồng ý huỷ" }, KEY),
    );
  });

  it("giữ theo %: gửi retainedPercent; bỏ trống ô % bị chặn, KHÔNG gọi API", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiOrderAt("CANCELLED") });
    const { user, dialog } = await openApprove();
    await user.click(within(dialog).getByRole("radio", { name: "Giữ theo % số tiền đã thu" }));
    await user.click(within(dialog).getByRole("button", { name: "Duyệt và huỷ đơn" }));
    expect(await within(dialog).findByText(/Nhập tỷ lệ lớn hơn 0/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText(/Giữ lại \(%\)/), "30");
    await user.click(within(dialog).getByRole("button", { name: "Duyệt và huỷ đơn" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(APPROVAL_PATH, { retainedPercent: 30 }, KEY),
    );
  });

  it("giữ theo số tiền thoả thuận: cần số + lý do + chi tiết; gửi agreedFee, KHÔNG kèm retainedPercent", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiOrderAt("CANCELLED") });
    const { user, dialog } = await openApprove();
    await user.click(
      within(dialog).getByRole("radio", { name: "Giữ theo số tiền thoả thuận với khách" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Duyệt và huỷ đơn" }));
    expect(await within(dialog).findByText("Nhập số tiền nguyên lớn hơn 0")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText(/Số tiền phí/), "500.000");
    await user.type(within(dialog).getByLabelText(/Lý do giữ phí/), "Phôi đã in");
    await user.type(within(dialog).getByLabelText(/Chi tiết đã thoả thuận/), "Gọi điện ngày 10/11");
    await user.click(within(dialog).getByRole("button", { name: "Duyệt và huỷ đơn" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        APPROVAL_PATH,
        { agreedFee: { amount: 500000, reason: "Phôi đã in", detail: "Gọi điện ngày 10/11" } },
        KEY,
      ),
    );
    expect(post.mock.calls[0]?.[1]).not.toHaveProperty("retainedPercent");
  });

  it("đổi chế độ phí: chọn 'Không giữ phí' lại thì không gửi phí đã nhập dở", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiOrderAt("CANCELLED") });
    const { user, dialog } = await openApprove();
    await user.click(within(dialog).getByRole("radio", { name: "Giữ theo % số tiền đã thu" }));
    await user.type(within(dialog).getByLabelText(/Giữ lại \(%\)/), "30");
    await user.click(within(dialog).getByRole("radio", { name: "Không giữ phí — hoàn toàn bộ" }));
    await user.click(within(dialog).getByRole("button", { name: "Duyệt và huỷ đơn" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(APPROVAL_PATH, {}, KEY));
  });
});

describe("Duyệt yêu cầu huỷ — lý do BE từ chối bằng tiếng Việt", () => {
  async function approveRefusedWith(code: string, status = 409) {
    const post = vi.spyOn(api, "post").mockRejectedValue(apiError(status, code));
    const { user } = await renderWithPending();
    await user.click(await screen.findByRole("button", { name: "Duyệt huỷ" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Duyệt và huỷ đơn" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    return { user, dialog, post };
  }

  it("ORDER_NOT_CANCELLABLE (đã dán nhãn giao hàng): đóng hộp thoại, toast tiếng Việt, tải lại yêu cầu", async () => {
    const toastError = vi.spyOn(toast, "error");
    const gets = vi.spyOn(api, "get");
    await approveRefusedWith("ORDER_NOT_CANCELLABLE");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const [title, detail] = toastError.mock.calls[0] ?? [];
    expect(title).toBe("Không duyệt được yêu cầu huỷ");
    expect(detail).toMatch(/dán nhãn giao hàng/);
    expect(detail).toMatch(/trả hàng/);
    expect(detail).not.toContain("English");
    // Dữ liệu cũ → tải lại yêu cầu + đơn để nút tự ẩn
    await waitFor(() => expect(callsTo(gets, REQUESTS_PATH)).toBeGreaterThanOrEqual(2));
  });

  it("ORDER_CANCELLATION_REQUEST_NOT_PENDING (người khác đã quyết / hết hiệu lực): đóng hộp thoại + toast", async () => {
    const toastError = vi.spyOn(toast, "error");
    await approveRefusedWith("ORDER_CANCELLATION_REQUEST_NOT_PENDING");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toastError.mock.calls[0]?.[1]).toMatch(/đã được quyết định hoặc đã hết hiệu lực/);
  });

  it("CANCELLATION_FEE_BEFORE_PRINTING: GIỮ hộp thoại + dữ liệu đã nhập, nói rõ chưa in thì hoàn toàn bộ", async () => {
    const { dialog } = await approveRefusedWith("CANCELLATION_FEE_BEFORE_PRINTING");
    expect(
      await within(dialog).findByText(/chưa có Đơn sản xuất nào in hàng loạt/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/trace-1/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("5xx / mã lạ: giữ hộp thoại, câu chung tiếng Việt (không lộ message tiếng Anh)", async () => {
    const { dialog } = await approveRefusedWith("SOMETHING_NEW", 500);
    expect(
      await within(dialog).findByText(/Đã xảy ra lỗi khi duyệt yêu cầu huỷ/),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/English/)).not.toBeInTheDocument();
  });
});

describe("Từ chối yêu cầu huỷ — lý do bắt buộc", () => {
  it("để trống lý do → báo lỗi, KHÔNG gọi API; có lý do → body {note}", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: apiCancellationRequest({ status: "REJECTED" }) });
    const { user } = await renderWithPending();
    await user.click(await screen.findByRole("button", { name: "Từ chối" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Từ chối yêu cầu" }));
    expect(await within(dialog).findByText("Hãy ghi lý do từ chối")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    await user.type(
      within(dialog).getByRole("textbox", { name: /Lý do từ chối/ }),
      "Hàng đã lấy xong",
    );
    await user.click(within(dialog).getByRole("button", { name: "Từ chối yêu cầu" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(REJECTION_PATH, { note: "Hàng đã lấy xong" }, KEY),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("BE từ chối vì yêu cầu đã được quyết → đóng hộp thoại + toast tiếng Việt 'Không từ chối được…'", async () => {
    vi.spyOn(api, "post").mockRejectedValue(
      apiError(409, "ORDER_CANCELLATION_REQUEST_NOT_PENDING"),
    );
    const toastError = vi.spyOn(toast, "error");
    const { user } = await renderWithPending();
    await user.click(await screen.findByRole("button", { name: "Từ chối" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox", { name: /Lý do từ chối/ }), "Không được");
    await user.click(within(dialog).getByRole("button", { name: "Từ chối yêu cầu" }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]?.[0]).toBe("Không từ chối được yêu cầu huỷ");
  });
});

describe("Kết quả tất toán sau khi duyệt (BE GET /refunds/orders/{id})", () => {
  const approved = () =>
    requestPage([apiCancellationRequest({ status: "APPROVED", retainedPercent: 30 })]);

  it("có payment-refunds:READ → hiện đã thu / phí / phải hoàn / phí còn thiếu do BE tính", async () => {
    await renderWf4Detail(WF4_PERMISSION_SETS.sales, {
      [REQUESTS_PATH]: approved,
      [REFUND_PATH]: () => apiRefund(),
    });
    const panel = (await screen.findByRole("heading", { name: "Kết quả tất toán tiền" }))
      .parentElement as HTMLElement;
    expect(await within(panel).findByText(/1\.000\.000/)).toBeInTheDocument(); // đã thu
    expect(within(panel).getByText(/Phí giữ lại \(30% số tiền đã thu\)/)).toBeInTheDocument();
    expect(within(panel).getAllByText(/300\.000/).length).toBeGreaterThanOrEqual(1); // phí + phí đã trừ
    expect(within(panel).getByText(/700\.000/)).toBeInTheDocument(); // phải hoàn
    expect(within(panel).getByText("Phôi đã in", { exact: false })).toBeInTheDocument();
    expect(within(panel).getByText(/Kế toán chuyển hoàn ngoài hệ thống/)).toBeInTheDocument();
  });

  it("phí vượt tiền đã thu → hiện khoản phí huỷ còn phải thu (feeOwed)", async () => {
    await renderWf4Detail(WF4_PERMISSION_SETS.sales, {
      [REQUESTS_PATH]: approved,
      [REFUND_PATH]: () =>
        apiRefund({
          settlements: [
            {
              settlementId: "s",
              kind: "ORDER_CANCELLED",
              collected: 200_000,
              fee: 500_000,
              feeCovered: 200_000,
              refundable: 0,
              feeOwed: 300_000,
            },
          ],
        }),
    });
    const panel = (await screen.findByRole("heading", { name: "Kết quả tất toán tiền" }))
      .parentElement as HTMLElement;
    const owed = await within(panel).findByText("Khoản phí huỷ còn phải thu");
    expect(owed.parentElement).toHaveTextContent(/300\.000/);
  });

  it("thiếu payment-refunds:READ (Sale chỉ có quyền huỷ) → không gọi API hoàn tiền, không hiện kết quả", async () => {
    const withoutRefund = WF4_PERMISSION_SETS.sales.filter(
      (code) => code !== "payment-refunds:READ",
    );
    const spy = await renderWf4Detail(withoutRefund, { [REQUESTS_PATH]: approved });
    await screen.findByRole("region", { name: "Yêu cầu huỷ của khách" });
    expect(
      screen.queryByRole("heading", { name: "Kết quả tất toán tiền" }),
    ).not.toBeInTheDocument();
    expect(callsTo(spy, REFUND_PATH)).toBe(0);
  });

  it("chưa có yêu cầu được duyệt (đang chờ) → không gọi API hoàn tiền", async () => {
    const { spy } = await renderWithPending();
    await screen.findByRole("region", { name: "Yêu cầu huỷ của khách" });
    expect(callsTo(spy, REFUND_PATH)).toBe(0);
  });

  it("tải kết quả lỗi → báo nhẹ trong panel, không chặn màn đơn", async () => {
    await renderWf4Detail(WF4_PERMISSION_SETS.sales, {
      [REQUESTS_PATH]: approved,
      [REFUND_PATH]: () => {
        throw apiError(500, "INTERNAL_ERROR");
      },
    });
    expect(
      await screen.findByText(/Không tải được kết quả tất toán/, undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: apiOrder.orderNumber })).toBeInTheDocument();
  });
});
