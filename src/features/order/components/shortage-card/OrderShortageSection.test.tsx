/**
 * Mục "Thiếu thùng" trên chi tiết đơn (docs 17 §4.14, BR-33; 16 BR-15): xem trước, gửi thẻ, Thực hiện từng hướng (kèm dời
 * cửa sổ D48), đóng phần còn lại, cổng quyền, lỗi hiện trong hộp thoại, tên thẻ không lộ UUID.
 */
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CHAT_PERMISSIONS, SALES_CONTRACT_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { DETAIL_PATH, HISTORY_PATH } from "../../__fixtures__/detail";
import { apiOrderWith } from "../../__fixtures__/order";
import {
  ORDER_PERMISSION_SETS,
  mockOrderApiGet,
  renderOrderScreen,
} from "../../__fixtures__/render";
import { CARD_ID, answeredCard, baseCard, previewOf, staffOf } from "../../__fixtures__/shortage";
import { OrderDetail } from "../OrderDetail";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());

const SALES: PermissionCode[] = [
  ...ORDER_PERMISSION_SETS.salesStaff,
  CHAT_PERMISSIONS.update,
  SALES_CONTRACT_PERMISSIONS.update,
];
const EXEC = `${DETAIL_PATH}/shortage-cards/${CARD_ID}/execution`;

async function open(preview: unknown, { permissions = SALES, status = "ON_HOLD" } = {}) {
  mockOrderApiGet(permissions, {
    [DETAIL_PATH]: () => apiOrderWith({ status, holdReason: "INVENTORY" }),
    [HISTORY_PATH]: () => [],
    [`${DETAIL_PATH}/shortage`]: () => preview,
    "/chat/conversations": () => ({ items: [{ id: "conv-1" }] }),
  });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: baseCard.orderId })} />);
  });
}

describe("OrderShortageSection", () => {
  it("đơn gửi được thẻ → bảng SKU, bốn hướng kèm hệ quả; 'Gửi thẻ' gửi MỘT lần vào hội thoại của đơn", async () => {
    await open(previewOf(null));
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    expect(await screen.findByRole("region", { name: "Thiếu thùng" })).toBeInTheDocument();
    expect(screen.getByText("Ly giấy 2 lớp 12oz")).toBeInTheDocument();
    expect(screen.getByText("Giảm số thùng")).toBeInTheDocument();
    expect(screen.getByText(/Dự kiến giao từ 22\/12\/2026/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Gửi thẻ thiếu thùng" }));
    await user.type(screen.getByLabelText(/Lời nhắn kèm thẻ/), "Em báo anh phương án");
    const submit = screen.getByRole("button", { name: "Gửi thẻ" });
    await user.dblClick(submit);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/chat/conversations/conv-1/cards/shortage", {
        orderId: baseCard.orderId,
        note: "Em báo anh phương án",
        replaceLive: false,
      }),
    );
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("đã có thẻ chờ khách → nút gửi hỏi 'Gửi thẻ mới thay thẻ cũ?' và gửi replaceLive", async () => {
    await open(previewOf(baseCard));
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    expect(await screen.findByText("TT-20261128-0001")).toBeInTheDocument();
    expect(screen.getByText("Chờ khách chọn", { selector: "p" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gửi thẻ thiếu thùng" }));
    expect(screen.getByText("Gửi thẻ mới thay thẻ cũ?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gửi thẻ mới" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/chat/conversations/conv-1/cards/shortage",
        expect.objectContaining({ replaceLive: true }),
      ),
    );
  });

  it("thẻ chưa có mã (BE cũ) → 'Thẻ thiếu thùng ngày …', không hiện UUID", async () => {
    await open(previewOf({ ...baseCard, number: null }));
    expect(await screen.findByText("Thẻ thiếu thùng ngày 28/11/2026")).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(CARD_ID))).not.toBeInTheDocument();
  });

  it("khách chọn 'chờ sản xuất' sau cửa sổ → hộp thoại dời cửa sổ tick sẵn, ngày kết thúc gợi ý = dự kiến + độ dài cửa sổ; gửi một lần", async () => {
    await open(previewOf(answeredCard("WAIT_FOR_PRODUCTION")));
    // Request chưa xong khi cú bấm thứ hai tới (như bấm đúp thật) → chỉ MỘT request
    const post = vi.spyOn(api, "post").mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();

    expect(
      await screen.findByText(/Khách đã chọn: Chờ sản xuất phần thiếu lúc/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Thực hiện: Chờ sản xuất phần thiếu" }));
    expect(screen.getByLabelText(/Dời cửa sổ giao tới ngày dự kiến 22\/12\/2026/)).toBeChecked();
    expect(screen.getByDisplayValue("27/12/2026")).toBeInTheDocument();

    await user.dblClick(screen.getByRole("button", { name: "Xác nhận thực hiện" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(
      `${EXEC}/wait-for-production`,
      { version: 3, moveWindow: true, windowEnd: "2026-12-27" },
      expect.objectContaining({
        headers: expect.objectContaining({ "Idempotency-Key": expect.any(String) }),
      }),
    );
  });

  it("bỏ tick dời cửa sổ → moveWindow=false, không gửi windowEnd", async () => {
    await open(previewOf(answeredCard("WAIT_FOR_PRODUCTION")));
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Thực hiện: Chờ sản xuất phần thiếu" }),
    );
    await user.click(screen.getByLabelText(/Dời cửa sổ giao tới ngày dự kiến/));
    await user.click(screen.getByRole("button", { name: "Xác nhận thực hiện" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0]?.[1]).toEqual({ version: 3, moveWindow: false });
  });

  it("bước con bị từ chối (cửa sổ đã khoá) → lý do hiện TRONG hộp thoại, hộp thoại giữ nguyên", async () => {
    await open(previewOf(answeredCard("WAIT_FOR_PRODUCTION")));
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(409, "DELIVERY_BATCH_WINDOW_LOCKED", "locked"),
    );
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Thực hiện: Chờ sản xuất phần thiếu" }),
    );
    await user.click(screen.getByRole("button", { name: "Xác nhận thực hiện" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/cửa sổ giao/i);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("'Giảm số thùng' → xác nhận nêu số thùng, đợt và số tiền giảm; gọi reduce-cartons", async () => {
    await open(previewOf(answeredCard("REDUCE_CARTONS")));
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Thực hiện: Giảm số thùng" }));
    expect(screen.getByText(/Bỏ 2 thùng thiếu của đợt 1; số phải thu giảm/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Xác nhận thực hiện" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        `${EXEC}/reduce-cartons`,
        { version: 3 },
        expect.anything(),
      ),
    );
  });

  it("'Huỷ đơn' → ghi chú điền sẵn, gọi cancel", async () => {
    await open(previewOf(answeredCard("CANCEL_ORDER")));
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Thực hiện: Huỷ đơn" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận thực hiện" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0]?.[0]).toBe(`${EXEC}/cancel`);
    expect(post.mock.calls[0]?.[1]).toMatchObject({ note: expect.stringContaining("huỷ đơn") });
  });

  it("giao một phần: chờ kho kiểm xong → khi đơn Partially Fulfilled hiện 'Đóng phần còn lại'", async () => {
    const card = answeredCard("SHIP_PART_CLOSE_REST", { executionStarted: true });
    await open(previewOf(card), { status: "PICKING" });
    expect(await screen.findByText("Chờ kho hoàn tất kiểm thùng một phần")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đóng phần còn lại" })).not.toBeInTheDocument();
  });

  it("giao một phần: kho kiểm xong (đơn Partially Fulfilled) → 'Đóng phần còn lại' mở hộp thoại lý do + phí", async () => {
    const card = answeredCard("SHIP_PART_CLOSE_REST", { executionStarted: true });
    await open(previewOf(card), { status: "PARTIALLY_FULFILLED" });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Đóng phần còn lại" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Đóng phần còn lại của đơn");
    expect(screen.queryByText("Chờ kho hoàn tất kiểm thùng một phần")).not.toBeInTheDocument();
  });

  it("thiếu quyền thực hiện → nút khoá kèm lý do (không ẩn)", async () => {
    await open(previewOf(answeredCard("REDUCE_CARTONS")), {
      permissions: [...ORDER_PERMISSION_SETS.readOnly, CHAT_PERMISSIONS.update],
    });
    expect(await screen.findByRole("button", { name: "Thực hiện: Giảm số thùng" })).toBeDisabled();
    expect(screen.getByText("Bạn không có quyền thực hiện hướng này.")).toBeInTheDocument();
  });

  it("thẻ đã cuối (Sale đã thực hiện) → không nút Thực hiện, lịch sử nêu ai làm", async () => {
    const done = answeredCard("CANCEL_ORDER", {
      status: "EXECUTED",
      executedAt: "2026-11-28T06:00:00Z",
    });
    await open({
      ...previewOf(null),
      history: [{ ...staffOf(done), executedByName: "Nguyễn Thị Lan" }],
    });
    expect(await screen.findByText(/Nguyễn Thị Lan thực hiện lúc/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Thực hiện:/ })).not.toBeInTheDocument();
  });

  it("đơn không treo vì thiếu thùng và chưa có thẻ → không hiện mục", async () => {
    await open({ ...previewOf(null), sendable: false, notSendable: "NOT_ON_HOLD" });
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(`${DETAIL_PATH}/shortage`, expect.anything()),
    );
    expect(screen.queryByRole("region", { name: "Thiếu thùng" })).not.toBeInTheDocument();
  });
});
