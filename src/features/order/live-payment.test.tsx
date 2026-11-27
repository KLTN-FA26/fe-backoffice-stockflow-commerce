/**
 * Trang đơn tự hỏi lại khi đơn "Chờ thanh toán" (tiền về qua bank feed SePay thì đơn tự sang "Đã xác nhận"):
 * hỏi đơn + các đợt mỗi vài giây khi tab đang mở, thôi hỏi khi đơn rời trạng thái đó, và làm mới cả trang + báo
 * người đang xem đúng một lần khi đơn vừa được xác nhận.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LIVE_PAYMENT_POLL_MS, useLiveOrderPayment } from "./live-payment";
import { orderKeys } from "./queries";

import type { ReactNode } from "react";
import type { Order } from "./types";

const success = vi.fn();
vi.mock("@/components/shared/Toast", () => ({
  toast: { success: (...args: unknown[]) => success(...args) },
}));

const ROUTE_ID = "7a360a46-1a7b-25c7-cb85-c6b28b886d55";

function order(status: string): Order {
  return { orderId: ROUTE_ID, orderNumber: "SO-20261119-700051", status } as unknown as Order;
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { invalidate, wrapper };
}

let visibility: DocumentVisibilityState = "visible";

beforeEach(() => {
  vi.useFakeTimers();
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  success.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useLiveOrderPayment — hỏi lại khi đơn chờ thanh toán", () => {
  it("hỏi lại đơn và các đợt thanh toán mỗi vài giây", () => {
    const { invalidate, wrapper } = setup();
    renderHook(() => useLiveOrderPayment(ROUTE_ID, order("Pending Payment")), { wrapper });

    vi.advanceTimersByTime(LIVE_PAYMENT_POLL_MS);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: orderKeys.detail(ROUTE_ID) });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: orderKeys.installmentsSummary(ROUTE_ID),
    });
  });

  it("không hỏi khi đơn không chờ thanh toán", () => {
    const { invalidate, wrapper } = setup();
    renderHook(() => useLiveOrderPayment(ROUTE_ID, order("Confirmed")), { wrapper });

    vi.advanceTimersByTime(LIVE_PAYMENT_POLL_MS * 3);

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("không hỏi khi tab bị ẩn, hỏi ngay khi quay lại tab", () => {
    const { invalidate, wrapper } = setup();
    visibility = "hidden";
    renderHook(() => useLiveOrderPayment(ROUTE_ID, order("Pending Payment")), { wrapper });

    vi.advanceTimersByTime(LIVE_PAYMENT_POLL_MS * 3);
    expect(invalidate).not.toHaveBeenCalled();

    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: orderKeys.detail(ROUTE_ID) });
  });
});

describe("useLiveOrderPayment — đơn vừa được xác nhận", () => {
  it("làm mới cả trang và báo một lần khi đơn rời Chờ thanh toán sang Đã xác nhận", () => {
    const { invalidate, wrapper } = setup();
    const { rerender } = renderHook(
      ({ current }: { current: Order }) => useLiveOrderPayment(ROUTE_ID, current),
      { wrapper, initialProps: { current: order("Pending Payment") } },
    );
    invalidate.mockClear();

    rerender({ current: order("Confirmed") });

    expect(invalidate).toHaveBeenCalledWith();
    expect(success).toHaveBeenCalledTimes(1);
    expect(success).toHaveBeenCalledWith(
      expect.stringContaining("SO-20261119-700051"),
      expect.any(String),
    );

    // Hết chờ thanh toán: không hỏi lại nữa, không báo lại.
    invalidate.mockClear();
    vi.advanceTimersByTime(LIVE_PAYMENT_POLL_MS * 3);
    rerender({ current: order("Confirmed") });
    expect(invalidate).not.toHaveBeenCalled();
    expect(success).toHaveBeenCalledTimes(1);
  });

  it("không báo gì cho đơn đã xác nhận từ trước khi mở trang", () => {
    const { wrapper } = setup();
    const { rerender } = renderHook(
      ({ current }: { current: Order }) => useLiveOrderPayment(ROUTE_ID, current),
      { wrapper, initialProps: { current: order("Confirmed") } },
    );
    rerender({ current: order("Confirmed") });

    expect(success).not.toHaveBeenCalled();
  });
});
