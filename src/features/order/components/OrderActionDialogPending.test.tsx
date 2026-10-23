import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

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
import { OrderDetail } from "./OrderDetail";

import type { OrderDto } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

/**
 * Dialog huỷ / release / quyết định công nợ KHÔNG được đóng khi request đang chạy (Esc, bấm ra ngoài,
 * nút Huỷ): đóng = unmount form = mất lần thử Idempotency-Key, mở lại sẽ gửi key mới cho cùng thao
 * tác. Khi rảnh, đóng bình thường. Xem `usePendingSafeDialog`.
 */

const DETAIL_PATH = `/orders/${apiOrder.orderId}`;
const CANCEL_PATH = `${DETAIL_PATH}/admin-cancellation`;
const RELEASE_PATH = `${DETAIL_PATH}/release`;
const APPROVE_PATH = `/orders/${apiOrder.orderId}/credit-approval`;
const REJECT_PATH = `/orders/${apiOrder.orderId}/credit-rejection`;
const WAREHOUSE_ID = "8f8f8f8f-0000-4000-8000-000000000001";
const DIALOG_FLOW_TIMEOUT_MS = 15_000;

const confirmed: OrderDto = { ...apiOrder, status: "CONFIRMED", paymentTerm: "PREPAID" };
const heldOrder = {
  ...apiOrder,
  status: "ON_HOLD" as const,
  paymentTerm: "CREDIT" as const,
  paymentStatus: "ON_CREDIT" as const,
  holdReason: "CREDIT" as const,
};

type User = ReturnType<typeof userEvent.setup>;

/** Radix khoá `pointer-events` của body khi dialog mở — tắt kiểm tra để giả lập bấm ra ngoài. */
const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function keyOf(post: { mock: { calls: unknown[][] } }, call: number) {
  const config = post.mock.calls[call]?.[2] as { headers?: Record<string, string> } | undefined;
  return config?.headers?.["Idempotency-Key"];
}

/** Ba cách người dùng có thể thử đóng dialog. */
async function tryDismiss(user: User, how: "escape" | "outside" | "cancel-button") {
  if (how === "escape") await user.keyboard("{Escape}");
  if (how === "outside") await user.click(document.body);
  if (how === "cancel-button") {
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Huỷ" }));
  }
}

async function renderDetail(order: OrderDto) {
  mockOrderApiGet(ORDER_PERMISSION_SETS.coordinator, {
    [DETAIL_PATH]: () => order,
    [`${DETAIL_PATH}/history`]: () => [],
    "/warehouses": () => ({ items: [{ id: WAREHOUSE_ID, prefix: "HN", name: "Kho Hà Nội" }] }),
  });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
}

async function submitCancel(user: User) {
  await user.click(await screen.findByRole("button", { name: "Huỷ đơn" }));
  await pickOrderSelectOption(user, /Lý do huỷ/, "Khách yêu cầu");
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Huỷ đơn" }));
  return dialog;
}

async function submitRelease(user: User) {
  await user.click(await screen.findByRole("button", { name: "Release đơn" }));
  await pickOrderSelectOption(user, /Kho xuất/, /HN — Kho Hà Nội/);
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Release" }));
  return dialog;
}

function renderCreditList() {
  mockOrderApiGet(ORDER_PERMISSION_SETS.accountant, {
    "/orders/credit-holds": () =>
      apiOrderPage([
        {
          order: heldOrder,
          checkedAt: "2026-09-07T03:16:00Z",
          creditLimit: 1_000_000,
          exposure: 800_000,
          orderAmount: 350_000,
        },
      ] as never[]),
    [`/orders/credit-position/${apiOrder.customerId}`]: () => apiCreditPosition,
  });
  renderOrderScreen(<CreditHoldList />);
}

async function submitApprove(user: User) {
  await user.click(await screen.findByRole("button", { name: /^Duyệt vượt hạn mức đơn/ }));
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText(/Ghi chú duyệt/), "Khách đã cam kết");
  await user.click(within(dialog).getByRole("button", { name: "Duyệt" }));
  return dialog;
}

async function submitReject(user: User) {
  await user.click(await screen.findByRole("button", { name: /^Từ chối vượt hạn mức đơn/ }));
  const dialog = await screen.findByRole("dialog");
  await screen.findByRole("region", { name: "Công nợ hiện tại của khách" });
  await pickOrderSelectOption(user, /Cách xử lý/, "Huỷ đơn");
  await user.type(within(dialog).getByLabelText(/Ghi chú/), "Không đủ điều kiện");
  await user.click(within(dialog).getByRole("button", { name: "Từ chối" }));
  return dialog;
}

afterEach(() => vi.restoreAllMocks());

describe("Huỷ đơn — dialog khi đang gửi", { timeout: DIALOG_FLOW_TIMEOUT_MS }, () => {
  it.each(["escape", "outside", "cancel-button"] as const)(
    "%s khi đang gửi → dialog vẫn mở, nút Huỷ bị khoá; thành công → đóng, đúng 1 request",
    async (how) => {
      const user = setupUser();
      await renderDetail(apiOrder);
      const pending = deferred<{ data: OrderDto }>();
      const post = vi.spyOn(api, "post").mockReturnValue(pending.promise);

      const dialog = await submitCancel(user);
      await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
      expect(within(dialog).getByRole("button", { name: "Huỷ" })).toBeDisabled();

      await tryDismiss(user, how);
      expect(screen.getByRole("dialog")).toBe(dialog);

      await act(async () => pending.resolve({ data: { ...apiOrder, status: "CANCELLED" } }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(post).toHaveBeenCalledTimes(1);
      expect(post).toHaveBeenCalledWith(
        CANCEL_PATH,
        { reasonCode: "CUSTOMER_REQUEST" },
        expect.anything(),
      );
    },
  );

  it("Esc khi đang gửi, rồi lỗi tạm thời → dialog vẫn mở + báo lỗi; gửi lại dùng CÙNG Idempotency-Key", async () => {
    const user = setupUser();
    await renderDetail(apiOrder);
    const pending = deferred<{ data: OrderDto }>();
    const post = vi
      .spyOn(api, "post")
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce({ data: { ...apiOrder, status: "CANCELLED" } });

    const dialog = await submitCancel(user);
    await tryDismiss(user, "escape");
    await act(async () => pending.reject(new ApiError(0, "NETWORK_ERROR", "offline")));

    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBe(dialog);
    await user.click(within(dialog).getByRole("button", { name: "Huỷ đơn" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(keyOf(post, 0)).toBeTruthy();
    expect(keyOf(post, 1)).toBe(keyOf(post, 0));
  });

  it.each(["escape", "outside", "cancel-button"] as const)(
    "rảnh (chưa gửi) → %s đóng dialog bình thường, không gửi request",
    async (how) => {
      const user = setupUser();
      await renderDetail(apiOrder);
      const post = vi.spyOn(api, "post");

      await user.click(await screen.findByRole("button", { name: "Huỷ đơn" }));
      await screen.findByRole("dialog");
      await tryDismiss(user, how);

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(post).not.toHaveBeenCalled();
    },
  );

  it("sau lỗi đã có kết quả (rảnh lại) → Esc đóng được", async () => {
    const user = setupUser();
    await renderDetail(apiOrder);
    vi.spyOn(api, "post").mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "offline"));

    const dialog = await submitCancel(user);
    await within(dialog).findByRole("alert");
    await tryDismiss(user, "escape");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("Release — dialog khi đang gửi", { timeout: DIALOG_FLOW_TIMEOUT_MS }, () => {
  it("Esc + bấm ra ngoài khi đang gửi → vẫn mở; thành công → đóng, đúng 1 request", async () => {
    const user = setupUser();
    await renderDetail(confirmed);
    const pending = deferred<{ data: OrderDto }>();
    const post = vi.spyOn(api, "post").mockReturnValue(pending.promise);

    const dialog = await submitRelease(user);
    await tryDismiss(user, "escape");
    await tryDismiss(user, "outside");
    expect(screen.getByRole("dialog")).toBe(dialog);

    await act(async () => pending.resolve({ data: { ...confirmed, status: "READY_TO_FULFILL" } }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      RELEASE_PATH,
      { warehouseId: WAREHOUSE_ID },
      expect.anything(),
    );
  });

  it("bấm ra ngoài khi đang gửi, rồi LOCK_TIMEOUT → vẫn mở; gửi lại dùng CÙNG key", async () => {
    const user = setupUser();
    await renderDetail(confirmed);
    const pending = deferred<{ data: OrderDto }>();
    const post = vi
      .spyOn(api, "post")
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce({ data: { ...confirmed, status: "READY_TO_FULFILL" } });

    const dialog = await submitRelease(user);
    await tryDismiss(user, "outside");
    await act(async () => pending.reject(new ApiError(409, "LOCK_TIMEOUT", "busy")));

    await within(dialog).findByText(/đang được xử lý ở nơi khác/);
    await user.click(within(dialog).getByRole("button", { name: "Release" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(keyOf(post, 1)).toBe(keyOf(post, 0));
  });
});

describe("Quyết định công nợ — dialog khi đang gửi", { timeout: DIALOG_FLOW_TIMEOUT_MS }, () => {
  it("duyệt: Esc khi đang gửi → vẫn mở; lỗi tạm thời → gửi lại CÙNG key; thành công → đóng", async () => {
    const user = setupUser();
    renderCreditList();
    const pending = deferred<{ data: unknown }>();
    const post = vi
      .spyOn(api, "post")
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce({ data: { ...heldOrder, status: "CONFIRMED" } });

    const dialog = await submitApprove(user);
    await tryDismiss(user, "escape");
    expect(screen.getByRole("dialog")).toBe(dialog);
    await act(async () => pending.reject(new ApiError(409, "LOCK_TIMEOUT", "busy")));

    await within(dialog).findByText(/đang được xử lý ở nơi khác/);
    await user.click(within(dialog).getByRole("button", { name: "Duyệt" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls.every(([url]) => url === APPROVE_PATH)).toBe(true);
    expect(keyOf(post, 1)).toBe(keyOf(post, 0));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("từ chối: bấm ra ngoài + nút Huỷ khi đang gửi → vẫn mở; thành công → đóng, đúng 1 request", async () => {
    const user = setupUser();
    renderCreditList();
    const pending = deferred<{ data: unknown }>();
    const post = vi.spyOn(api, "post").mockReturnValue(pending.promise);

    const dialog = await submitReject(user);
    await tryDismiss(user, "outside");
    await tryDismiss(user, "cancel-button");
    expect(screen.getByRole("dialog")).toBe(dialog);

    await act(async () => pending.resolve({ data: { ...heldOrder, status: "CANCELLED" } }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      REJECT_PATH,
      { action: "CANCEL", note: "Không đủ điều kiện" },
      expect.anything(),
    );
  });
});

/* ── Bấm đúp nút gửi: `isPending` chỉ đổi ở render sau → phải chặn đồng bộ (beginSubmit) ── */

describe("Bấm đúp nút gửi → đúng 1 request", { timeout: DIALOG_FLOW_TIMEOUT_MS }, () => {
  /** POST trả về sau một nhịp — đủ để cú bấm thứ hai rơi vào lúc request đầu còn chạy. */
  const slowPost = (data: unknown) =>
    vi
      .spyOn(api, "post")
      .mockImplementation(() => new Promise((r) => setTimeout(() => r({ data }), 50)));

  it("huỷ đơn", async () => {
    const user = setupUser();
    await renderDetail(apiOrder);
    const post = slowPost({ ...apiOrder, status: "CANCELLED" });
    await user.click(await screen.findByRole("button", { name: "Huỷ đơn" }));
    await pickOrderSelectOption(user, /Lý do huỷ/, "Khách yêu cầu");
    await user.dblClick(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Huỷ đơn" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("release", async () => {
    const user = setupUser();
    await renderDetail(confirmed);
    const post = slowPost({ ...confirmed, status: "READY_TO_FULFILL" });
    await user.click(await screen.findByRole("button", { name: "Release đơn" }));
    await pickOrderSelectOption(user, /Kho xuất/, /HN — Kho Hà Nội/);
    await user.dblClick(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Release" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("duyệt công nợ", async () => {
    const user = setupUser();
    renderCreditList();
    const post = slowPost({ ...heldOrder, status: "CONFIRMED" });
    await user.click(await screen.findByRole("button", { name: /^Duyệt vượt hạn mức đơn/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Ghi chú duyệt/), "OK");
    await user.dblClick(within(dialog).getByRole("button", { name: "Duyệt" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("từ chối công nợ", async () => {
    const user = setupUser();
    renderCreditList();
    const post = slowPost({ ...heldOrder, status: "CANCELLED" });
    await user.click(await screen.findByRole("button", { name: /^Từ chối vượt hạn mức đơn/ }));
    const dialog = await screen.findByRole("dialog");
    await screen.findByRole("region", { name: "Công nợ hiện tại của khách" });
    await pickOrderSelectOption(user, /Cách xử lý/, "Huỷ đơn");
    await user.type(within(dialog).getByLabelText(/Ghi chú/), "Không đủ điều kiện");
    await user.dblClick(within(dialog).getByRole("button", { name: "Từ chối" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("sau lỗi tạm thời, bấm lại vẫn gửi được (guard được nhả khi có kết quả)", async () => {
    const user = setupUser();
    await renderDetail(apiOrder);
    const post = vi
      .spyOn(api, "post")
      .mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "offline"))
      .mockResolvedValueOnce({ data: { ...apiOrder, status: "CANCELLED" } });
    const dialog = await submitCancel(user);
    await within(dialog).findByRole("alert");
    await user.click(within(dialog).getByRole("button", { name: "Huỷ đơn" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  });
});
