/**
 * Màn chi tiết đơn — đóng phần còn lại kèm phí đã thoả thuận (BE PR #150).
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { apiPartialOrder } from "../__fixtures__/order";
import { DETAIL_PATH, renderDetail } from "../__fixtures__/detail";
import { ORDER_PERMISSION_SETS, pickSelectOption } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

describe("OrderDetail — Đóng phần còn lại kèm phí đã thoả thuận", () => {
  const CLOSURE_PATH = `${DETAIL_PATH}/remainder-closure`;
  // Thao tác ghi đơn gửi Idempotency-Key ở header (PR #27), không vào body
  const WITH_KEY = { headers: { "Idempotency-Key": expect.any(String) } };

  async function openClosureDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "Đóng phần còn lại" }));
    await pickSelectOption(user, /Lý do đóng/, "Khách yêu cầu");
  }
  const submit = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getAllByRole("button", { name: "Đóng phần còn lại" }).at(-1) as HTMLElement);

  async function fillFee(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("checkbox", { name: /Giữ một khoản phí/ }));
    await user.type(screen.getByLabelText(/Số tiền phí/), "4.000.000");
    await user.type(screen.getByLabelText(/Lý do giữ phí/), "  Đã in 2 lô  ");
    await user.type(screen.getByLabelText(/Chi tiết đã thoả thuận/), "Khách đồng ý qua điện thoại");
  }

  it("bật phí → POST kèm agreedFee {amount (số nguyên VND), reason, detail} đã trim", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiPartialOrder);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiPartialOrder });
    const user = userEvent.setup();

    await openClosureDialog(user);
    await fillFee(user);
    await submit(user);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        CLOSURE_PATH,
        {
          reasonCode: "CUSTOMER_REQUEST",
          agreedFee: {
            amount: 4_000_000,
            reason: "Đã in 2 lô",
            detail: "Khách đồng ý qua điện thoại",
          },
        },
        WITH_KEY,
      ),
    );
  });

  it("không bật phí → body không có agreedFee", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiPartialOrder);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiPartialOrder });
    const user = userEvent.setup();

    await openClosureDialog(user);
    await submit(user);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(CLOSURE_PATH, { reasonCode: "CUSTOMER_REQUEST" }, WITH_KEY),
    );
  });

  it("số tiền có dấu thập phân → báo lỗi thay vì đọc thành số lớn gấp 100 lần; số hợp lệ hiện bản xem trước", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiPartialOrder);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiPartialOrder });
    const user = userEvent.setup();

    await openClosureDialog(user);
    await fillFee(user);
    // fillFee gõ "4.000.000" → bản xem trước đúng số sẽ gửi
    expect(screen.getByText(/Sẽ ghi nhận: .*4\.000\.000/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Số tiền phí/));
    await user.type(screen.getByLabelText(/Số tiền phí/), "150000.50");
    expect(screen.queryByText(/Sẽ ghi nhận/)).not.toBeInTheDocument();
    await submit(user);

    expect(await screen.findByText("Nhập số tiền nguyên lớn hơn 0")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("phí không hợp lệ (số tiền, lý do, chi tiết) → chặn trước khi gọi API, lỗi từng ô", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiPartialOrder);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiPartialOrder });
    const user = userEvent.setup();

    await openClosureDialog(user);
    await user.click(screen.getByRole("checkbox", { name: /Giữ một khoản phí/ }));
    await user.type(screen.getByLabelText(/Số tiền phí/), "12abc");
    await submit(user);

    expect(await screen.findByText("Nhập số tiền nguyên lớn hơn 0")).toBeInTheDocument();
    expect(screen.getByText("Nhập lý do giữ phí")).toBeInTheDocument();
    expect(screen.getByText("Nhập chi tiết đã thoả thuận")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    // Sửa số tiền → lỗi của ô đó biến mất ngay
    await user.clear(screen.getByLabelText(/Số tiền phí/));
    await user.type(screen.getByLabelText(/Số tiền phí/), "1000");
    expect(screen.queryByText("Nhập số tiền nguyên lớn hơn 0")).not.toBeInTheDocument();
  });

  it("409 CANCELLATION_FEE_BEFORE_PRINTING → dialog giữ nguyên, báo tiếng Việt; bỏ phí rồi gửi lại được", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiPartialOrder);
    const post = vi
      .spyOn(api, "post")
      .mockRejectedValueOnce(new ApiError(409, "CANCELLATION_FEE_BEFORE_PRINTING", "English"))
      .mockResolvedValueOnce({ data: apiPartialOrder });
    const user = userEvent.setup();

    await openClosureDialog(user);
    await fillFee(user);
    await submit(user);

    expect(await screen.findByText(/Đơn chưa bắt đầu in/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/Số tiền phí/)).toHaveValue("4.000.000");

    await user.click(screen.getByRole("checkbox", { name: /Giữ một khoản phí/ }));
    await submit(user);
    await waitFor(() =>
      expect(post).toHaveBeenLastCalledWith(
        CLOSURE_PATH,
        { reasonCode: "CUSTOMER_REQUEST" },
        WITH_KEY,
      ),
    );
  });

  it("400 phí vượt giá trị hàng in → câu tiếng Việt nêu giới hạn, dialog giữ nguyên", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiPartialOrder);
    vi.spyOn(api, "post").mockRejectedValue(new ApiError(400, "VALIDATION_FAILED", "English"));
    const user = userEvent.setup();

    await openClosureDialog(user);
    await fillFee(user);
    await submit(user);

    expect(await screen.findByText(/không vượt giá trị phần hàng in bị đóng/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("mở lại hộp thoại thì ô phí được xoá sạch", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiPartialOrder);
    vi.spyOn(api, "post").mockResolvedValue({ data: apiPartialOrder });
    const user = userEvent.setup();

    await openClosureDialog(user);
    await fillFee(user);
    await user.click(screen.getByRole("button", { name: "Huỷ" }));
    await user.click(screen.getByRole("button", { name: "Đóng phần còn lại" }));

    expect(screen.getByRole("checkbox", { name: /Giữ một khoản phí/ })).not.toBeChecked();
    expect(screen.queryByLabelText(/Số tiền phí/)).not.toBeInTheDocument();
  });
});
