/**
 * Cache liên module: thao tác Order đổi giữ chỗ tồn phải làm cache tồn / phiếu giữ hàng của
 * Inventory hết hạn (BE OrderServiceImpl.cancelLoaded, CreditHoldService.refuse). Release (PR #74):
 * `OrderRelease.test.tsx`. Chạy hook thật qua mock adapter, cache Inventory seed sẵn bằng
 * đúng chuỗi key nhánh Inventory đang dùng (`INVENTORY_QUERY_KEYS.stock`).
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { SHARED_QUERY_ROOTS } from "@/constants";
import { api } from "@/lib/api/client";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetOrderMockStore } from "@/lib/api/mock-routes-orders";

import {
  useAdminCancelOrder,
  useApproveCreditHold,
  useCloseOrderRemainder,
  useDecidePartialShipment,
  useHoldOrder,
  useRecordDeliveryFailure,
  useRejectCreditHold,
  useResolveOrderHold,
} from "./mutations";
import { orderKeys } from "./queries";

import type { ReactNode } from "react";

const originalAdapter = api.defaults.adapter;

const CONFIRMED_STANDARD = "ORD-2026-0013"; // Confirmed, chỉ hàng sẵn
const CREDIT_ON_HOLD = "ORD-2026-0006"; // On Hold, chuyển khoản → CREDIT (giữ lý do CREDIT)
const SHIPPED = "ORD-2026-0007"; // Shipped, chưa chia lô
const PARTIAL = "ORD-2026-0009"; // Partially Fulfilled, một lô đã bàn giao

// Key Inventory build dưới root dùng chung (constants/query-roots.ts)
const STOCK_KEY = ["inventory-stock-items", "list", "WH-HN-01", {}] as const;
const RESERVATION_KEY = ["inventory-stock-reservations", "list", "WH-HN-01", {}] as const;
const MOVEMENT_KEY = ["inventory-stock-movements", "list", "WH-HN-01", {}] as const;

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});

afterEach(() => resetOrderMockStore());

afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

function seededClient() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  for (const key of [STOCK_KEY, RESERVATION_KEY, MOVEMENT_KEY, orderKeys.all]) {
    queryClient.setQueryData(key, { cached: true });
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const invalidated = (key: readonly unknown[]) =>
    queryClient.getQueryState(key)?.isInvalidated ?? false;
  return { invalidated, wrapper };
}

async function run<T>(useHook: () => { mutateAsync: (vars: T) => Promise<unknown> }, vars: T) {
  return (await runWithResult(useHook, vars)).invalidated;
}

async function runWithResult<T, R>(
  useHook: () => { mutateAsync: (vars: T) => Promise<R> },
  vars: T,
) {
  const { invalidated, wrapper } = seededClient();
  const { result } = renderHook(useHook, { wrapper });
  let data: R | undefined;
  await act(async () => {
    data = await result.current.mutateAsync(vars);
  });
  return { invalidated, data };
}

describe("Order mutation → cache tồn / giữ chỗ của Inventory", () => {
  it("huỷ admin (nhả giữ chỗ) → tồn + phiếu giữ hàng tải lại; sổ cái không đổi", async () => {
    const invalidated = await run(() => useAdminCancelOrder(), {
      id: CONFIRMED_STANDARD,
      reasonCode: "CUSTOMER_REQUEST" as const,
    });
    expect(invalidated(orderKeys.all)).toBe(true);
    expect(invalidated(STOCK_KEY)).toBe(true);
    expect(invalidated(RESERVATION_KEY)).toBe(true);
    expect(invalidated(MOVEMENT_KEY)).toBe(false);
  });

  it.each([
    { action: "CANCEL" as const },
    { action: "SWITCH_TO_PREPAID" as const },
    { action: "SWITCH_TO_DEPOSIT" as const, depositPercent: 40 },
  ])("từ chối công nợ $action → tồn + phiếu giữ hàng tải lại", async (variant) => {
    const invalidated = await run(() => useRejectCreditHold(), {
      id: CREDIT_ON_HOLD,
      note: "Từ chối",
      ...variant,
    });
    expect(invalidated(STOCK_KEY)).toBe(true);
    expect(invalidated(RESERVATION_KEY)).toBe(true);
    expect(invalidated(MOVEMENT_KEY)).toBe(false);
  });

  it("duyệt công nợ (ON_HOLD → CONFIRMED, vẫn giữ hàng) → chỉ cache đơn", async () => {
    const invalidated = await run(() => useApproveCreditHold(), {
      id: CREDIT_ON_HOLD,
      note: "Khách cam kết",
    });
    expect(invalidated(orderKeys.all)).toBe(true);
    expect(invalidated(STOCK_KEY)).toBe(false);
    expect(invalidated(RESERVATION_KEY)).toBe(false);
  });
});

describe("Order mutation — giữ / gỡ giữ / giao thất bại / đóng phần còn lại (BE PR #133)", () => {
  it("giữ đơn → trả Order On Hold; chỉ cache đơn (BE putOnHold không gọi inventory)", async () => {
    const { invalidated, data } = await runWithResult(() => useHoldOrder(), {
      id: CONFIRMED_STANDARD,
      reasonCode: "ADDRESS" as const,
      note: "Sai phường",
    });
    expect(data).toMatchObject({ status: "On Hold", holdReason: "ADDRESS" });
    expect(invalidated(orderKeys.all)).toBe(true);
    expect(invalidated(STOCK_KEY)).toBe(false);
    expect(invalidated(RESERVATION_KEY)).toBe(false);
  });

  it("gỡ giữ → trả Order về trạng thái trước khi giữ; chỉ cache đơn", async () => {
    await runWithResult(() => useHoldOrder(), {
      id: CONFIRMED_STANDARD,
      reasonCode: "CUSTOMER" as const,
      note: "",
    });
    const { invalidated, data } = await runWithResult(() => useResolveOrderHold(), {
      id: CONFIRMED_STANDARD,
      note: "Khách đã xác nhận",
    });
    expect(data).toMatchObject({ status: "Confirmed", holdReason: null });
    expect(invalidated(orderKeys.all)).toBe(true);
    expect(invalidated(RESERVATION_KEY)).toBe(false);
  });

  it("ghi giao thất bại → trả Order Delivery Failed + lý do; chỉ cache đơn", async () => {
    const { invalidated, data } = await runWithResult(() => useRecordDeliveryFailure(), {
      id: SHIPPED,
      reasonCode: "REFUSED" as const,
      note: "",
    });
    expect(data).toMatchObject({ status: "Delivery Failed", deliveryFailureReason: "REFUSED" });
    expect(invalidated(orderKeys.all)).toBe(true);
    expect(invalidated(STOCK_KEY)).toBe(false);
  });

  it("đóng phần còn lại (BE releaseHolds phần không giao) → tồn + phiếu giữ hàng tải lại; sổ cái không đổi", async () => {
    const { invalidated, data } = await runWithResult(() => useCloseOrderRemainder(), {
      id: PARTIAL,
      reasonCode: "OUT_OF_STOCK" as const,
      note: "",
    });
    expect(data?.status).toBe("Shipped");
    expect(data?.lines[0]?.cancelledQuantity).toBeGreaterThan(0);
    expect(invalidated(orderKeys.all)).toBe(true);
    expect(invalidated(STOCK_KEY)).toBe(true);
    expect(invalidated(RESERVATION_KEY)).toBe(true);
    expect(invalidated(MOVEMENT_KEY)).toBe(false);
  });
});

describe("Order mutation — Idempotency-Key đi tới API ở header, không vào body", () => {
  async function postedWith(call: () => Promise<unknown>) {
    const post = vi.spyOn(api, "post");
    await call();
    const args = post.mock.calls[0];
    post.mockRestore();
    return args;
  }

  it("huỷ admin", async () => {
    const args = await postedWith(() =>
      runWithResult(() => useAdminCancelOrder(), {
        id: CONFIRMED_STANDARD,
        reasonCode: "CUSTOMER_REQUEST" as const,
        idempotencyKey: "k-c",
      }),
    );
    expect(args).toEqual([
      `/orders/${CONFIRMED_STANDARD}/admin-cancellation`,
      { reasonCode: "CUSTOMER_REQUEST" },
      { headers: { "Idempotency-Key": "k-c" } },
    ]);
  });

  it("giữ đơn", async () => {
    const args = await postedWith(() =>
      runWithResult(() => useHoldOrder(), {
        id: CONFIRMED_STANDARD,
        reasonCode: "FRAUD" as const,
        note: "",
        idempotencyKey: "k-h",
      }),
    );
    expect(args).toEqual([
      `/orders/${CONFIRMED_STANDARD}/hold`,
      { reasonCode: "FRAUD" },
      { headers: { "Idempotency-Key": "k-h" } },
    ]);
  });

  it("đóng phần còn lại", async () => {
    const args = await postedWith(() =>
      runWithResult(() => useCloseOrderRemainder(), {
        id: PARTIAL,
        reasonCode: "OUT_OF_STOCK" as const,
        note: "",
        idempotencyKey: "k-r",
      }),
    );
    expect(args).toEqual([
      `/orders/${PARTIAL}/remainder-closure`,
      { reasonCode: "OUT_OF_STOCK" },
      { headers: { "Idempotency-Key": "k-r" } },
    ]);
  });
});

describe("useDecidePartialShipment — làm mới những gì phụ thuộc cờ giao một phần", () => {
  it("invalidate đơn + lịch sử, task / phiên đóng gói và chuyến xe; không đụng dữ liệu khác", async () => {
    vi.spyOn(api, "put").mockResolvedValue({ data: null });
    const client = new QueryClient();
    const keys = {
      detail: orderKeys.detail("o1"),
      history: orderKeys.history("o1"),
      packing: [SHARED_QUERY_ROOTS.fulfillmentTasks, "packing", "session", "t1"],
      tasks: [SHARED_QUERY_ROOTS.fulfillmentTasks, "list", {}],
      loads: [SHARED_QUERY_ROOTS.fulfillmentLoads, "list", {}],
      unrelated: ["suppliers", "list"],
    } as const;
    for (const key of Object.values(keys)) client.setQueryData(key, { cached: true });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDecidePartialShipment(), { wrapper });

    await act(async () => result.current.mutate({ id: "o1", allowed: true, note: "" }));

    const stale = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;
    await waitFor(() => expect(stale(keys.detail)).toBe(true));
    expect(stale(keys.history)).toBe(true);
    expect(stale(keys.packing)).toBe(true);
    expect(stale(keys.tasks)).toBe(true);
    expect(stale(keys.loads)).toBe(true);
    expect(stale(keys.unrelated)).toBe(false);
  });
});
