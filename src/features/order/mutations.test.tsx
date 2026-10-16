/**
 * Cache liên module: thao tác Order đổi giữ chỗ tồn phải làm cache tồn / phiếu giữ hàng của
 * Inventory hết hạn (BE OrderServiceImpl.cancelLoaded, OrderReleaseService.release,
 * CreditHoldService.refuse). Chạy hook thật qua mock adapter, cache Inventory seed sẵn bằng
 * đúng chuỗi key nhánh Inventory đang dùng (`INVENTORY_QUERY_KEYS.stock`).
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetOrderMockStore } from "@/lib/api/mock-routes-orders";

import {
  useAdminCancelOrder,
  useApproveCreditHold,
  useRejectCreditHold,
  useReleaseOrder,
} from "./mutations";
import { orderKeys } from "./queries";

import type { ReactNode } from "react";

const originalAdapter = api.defaults.adapter;

const CONFIRMED_STANDARD = "ORD-2026-0013"; // Confirmed, chỉ hàng sẵn
const CREDIT_ON_HOLD = "ORD-2026-0006"; // On Hold, chuyển khoản → CREDIT

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
  const { invalidated, wrapper } = seededClient();
  const { result } = renderHook(useHook, { wrapper });
  await act(async () => {
    await result.current.mutateAsync(vars);
  });
  return invalidated;
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

  it("release (ghim giữ chỗ vào kho xuất) → tồn + phiếu giữ hàng tải lại", async () => {
    const invalidated = await run(() => useReleaseOrder(), {
      id: CONFIRMED_STANDARD,
      warehouseId: "WH-HN-01",
    });
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
