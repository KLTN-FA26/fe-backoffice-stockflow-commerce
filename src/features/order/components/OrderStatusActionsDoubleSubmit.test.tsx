import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { apiOrder, apiOrderWith, apiPartialOrder } from "../__fixtures__/order";
import {
  ORDER_PERMISSION_SETS,
  mockOrderApiGet,
  pickSelectOption,
  renderOrderScreen,
} from "../__fixtures__/render";
import { OrderDetail } from "./OrderDetail";

import type { OrderDto } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

/**
 * Bốn thao tác vòng đời (giữ / gỡ giữ / giao thất bại / đóng phần còn lại) gửi ĐÚNG MỘT request cho một
 * lần bấm, kể cả bấm đúp. Live BE 5683fe14: bấm đúp "Giữ đơn" từng gửi 2 POST (cùng Idempotency-Key, BE
 * replay nên không giữ hai lần) vì `isPending` chỉ đổi ở lần render sau. Hai cú click được phát ĐỒNG BỘ
 * trong một `act` để mô phỏng đúng khe đó — `userEvent` chờ giữa hai cú nên React kịp render và không
 * tái hiện được lỗi.
 */

const DETAIL_PATH = `/orders/${apiOrder.orderId}`;
const DIALOG_FLOW_TIMEOUT_MS = 15_000;
type User = ReturnType<typeof userEvent.setup>;

interface ActionCase {
  name: string;
  order: OrderDto;
  path: string;
  /** Mở dialog + điền nội dung hợp lệ; `variant` đổi nội dung (để kiểm key mới). */
  fill: (user: User, dialog: HTMLElement, variant?: string) => Promise<void>;
}

const CASES: ActionCase[] = [
  {
    name: "Giữ đơn",
    order: { ...apiOrder, status: "PICKING" },
    path: `${DETAIL_PATH}/hold`,
    fill: async (user, dialog, variant = "Sai phường") => {
      await pickSelectOption(user, /Lý do giữ/, "Sai địa chỉ / hãng vận chuyển không giao tới");
      const note = within(dialog).getByLabelText(/Ghi chú/);
      await user.clear(note);
      await user.type(note, variant);
    },
  },
  {
    name: "Gỡ giữ",
    order: apiOrderWith({ status: "ON_HOLD", holdReason: "ADDRESS", statusBeforeHold: "PICKING" }),
    path: `${DETAIL_PATH}/hold/resolution`,
    fill: async (user, dialog, variant = "Đã xác minh địa chỉ") => {
      const note = within(dialog).getByLabelText(/Cách đã xử lý/);
      await user.clear(note);
      await user.type(note, variant);
    },
  },
  {
    name: "Ghi giao thất bại",
    order: { ...apiOrder, status: "SHIPPED" },
    path: `${DETAIL_PATH}/delivery-failure`,
    fill: async (user, dialog, variant = "Gọi không nghe máy") => {
      await pickSelectOption(user, /Lý do giao thất bại/, "Khách vắng mặt");
      const note = within(dialog).getByLabelText(/Ghi chú/);
      await user.clear(note);
      await user.type(note, variant);
    },
  },
  {
    name: "Đóng phần còn lại",
    order: apiPartialOrder,
    path: `${DETAIL_PATH}/remainder-closure`,
    fill: async (user, dialog, variant = "Hết hàng cả kho") => {
      await pickSelectOption(user, /Lý do đóng/, "Lý do khác");
      const note = within(dialog).getByLabelText(/Ghi chú/);
      await user.clear(note);
      await user.type(note, variant);
    },
  },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function keyOf(post: { mock: { calls: unknown[][] } }, call: number) {
  const config = post.mock.calls[call]?.[2] as { headers?: Record<string, string> } | undefined;
  return config?.headers?.["Idempotency-Key"];
}

async function openDialog(c: ActionCase) {
  const get = mockOrderApiGet(ORDER_PERMISSION_SETS.coordinator, {
    [DETAIL_PATH]: () => c.order,
    [`${DETAIL_PATH}/history`]: () => [],
  });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: c.name }));
  const dialog = await screen.findByRole("dialog");
  return { user, dialog, get };
}

const submitButton = (dialog: HTMLElement, c: ActionCase) =>
  within(dialog).getByRole("button", { name: c.name });

/** Hai cú click trong cùng một nhịp — trước khi React render lại với `isPending`. */
function doubleClickSync(button: HTMLElement) {
  act(() => {
    fireEvent.click(button);
    fireEvent.click(button);
  });
}

afterEach(() => vi.restoreAllMocks());

describe.each(CASES)("$name — một lần bấm, một request", (c) => {
  it(
    "bấm đúp đồng bộ + bấm thêm khi đang gửi → đúng 1 POST; thành công → đóng dialog, tải lại đơn",
    { timeout: DIALOG_FLOW_TIMEOUT_MS },
    async () => {
      const { user, dialog, get } = await openDialog(c);
      await c.fill(user, dialog);
      const pending = deferred<{ data: OrderDto }>();
      const post = vi.spyOn(api, "post").mockReturnValue(pending.promise);

      doubleClickSync(submitButton(dialog, c));
      await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
      act(() => {
        fireEvent.click(submitButton(dialog, c));
      });
      expect(post).toHaveBeenCalledTimes(1);
      expect(post.mock.calls[0]?.[0]).toBe(c.path);
      expect(keyOf(post, 0)).toBeTruthy();

      const detailReads = get.mock.calls.filter(([url]) => url === DETAIL_PATH).length;
      await act(async () => pending.resolve({ data: c.order }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() =>
        expect(get.mock.calls.filter(([url]) => url === DETAIL_PATH).length).toBeGreaterThan(
          detailReads,
        ),
      );
      expect(post).toHaveBeenCalledTimes(1);
    },
  );

  it(
    "lỗi tạm thời → dialog giữ + báo lỗi; bấm lại cùng nội dung → gửi được, CÙNG Idempotency-Key",
    { timeout: DIALOG_FLOW_TIMEOUT_MS },
    async () => {
      const { user, dialog } = await openDialog(c);
      await c.fill(user, dialog);
      const post = vi
        .spyOn(api, "post")
        .mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "offline"))
        .mockResolvedValueOnce({ data: c.order });

      doubleClickSync(submitButton(dialog, c));
      expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
      expect(post).toHaveBeenCalledTimes(1);

      await user.click(submitButton(dialog, c));
      await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
      expect(keyOf(post, 1)).toBe(keyOf(post, 0));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    },
  );

  it(
    "lỗi tạm thời rồi đổi nội dung → gửi được với key MỚI (một key không đi với hai body)",
    { timeout: DIALOG_FLOW_TIMEOUT_MS },
    async () => {
      const { user, dialog } = await openDialog(c);
      await c.fill(user, dialog);
      const post = vi
        .spyOn(api, "post")
        .mockRejectedValueOnce(new ApiError(409, "LOCK_TIMEOUT", "busy"))
        .mockResolvedValueOnce({ data: c.order });

      await user.click(submitButton(dialog, c));
      await within(dialog).findByRole("alert");
      await c.fill(user, dialog, "Nội dung đã sửa");
      await user.click(submitButton(dialog, c));

      await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
      expect(post.mock.calls[0]?.[1]).not.toEqual(post.mock.calls[1]?.[1]);
      expect(keyOf(post, 1)).not.toBe(keyOf(post, 0));
    },
  );
});
