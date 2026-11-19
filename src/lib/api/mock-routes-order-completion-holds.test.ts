/**
 * Mock giữ hoàn tất đơn (WF-05 GH-2, BE `OrderCompletionHoldController`) qua axios thật + `features/order/completion-hold-api.ts`:
 * quyền, một lần giữ mở mỗi đơn, OTHER cần ghi chú, đơn đã qua hoàn tất không giữ được, gỡ giữ cần ghi chú.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCompletionHold,
  holdCompletion,
  releaseCompletionHold,
} from "@/features/order/completion-hold-api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";
import { orders } from "@/lib/mock-data";

import { activateMockAdapter } from "./mock-adapter";
import { resetOrderMockStore } from "./mock-routes-orders";

// Mỗi request mock trễ ~215ms (Math.random = 0.05).
vi.setConfig({ testTimeout: 30_000 });

const originalAdapter = api.defaults.adapter;

const orderWith = (status: string) => {
  const order = orders.find((o) => o.status === status);
  if (!order) throw new Error(`mock-data không có đơn "${status}"`);
  return order;
};

function actAs(userId: string) {
  useAuthStore.setState({
    user: {
      userId,
      fullName: "T",
      email: "t@t.vn",
      roles: [],
      username: "t",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    isAuthenticated: true,
    status: "authenticated",
  });
}

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected request to fail");
}

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});
beforeEach(() => actAs("USER-SALE-01"));
afterEach(() => resetOrderMockStore());
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("completion hold (mock)", () => {
  it("không giữ → null; giữ → GET trả lần giữ mở; giữ lần nữa → 409 ALREADY_HELD", async () => {
    const order = orderWith("Delivered");
    expect(await getCompletionHold(order.orderId)).toBeNull();
    const hold = await holdCompletion({
      orderId: order.orderId,
      reasonCode: "DELIVERY_DISPUTED",
      note: "Khách báo thiếu thùng",
    });
    expect(hold).toMatchObject({
      orderId: order.orderId,
      reasonCode: "DELIVERY_DISPUTED",
      note: "Khách báo thiếu thùng",
      heldBy: "USER-SALE-01",
      releasedAt: null,
    });
    expect(await getCompletionHold(order.orderId)).toMatchObject({ id: hold.id });
    expect(
      await captureError(
        holdCompletion({ orderId: order.orderId, reasonCode: "DELIVERY_DISPUTED" }),
      ),
    ).toMatchObject({ status: 409, code: "ORDER_COMPLETION_ALREADY_HELD" });
  });

  it("OTHER không ghi chú → 400; đơn đã hoàn tất → 409 HOLD_NOT_APPLICABLE", async () => {
    const delivered = orderWith("Delivered");
    expect(
      await captureError(holdCompletion({ orderId: delivered.orderId, reasonCode: "OTHER" })),
    ).toMatchObject({ status: 400, code: "VALIDATION_FAILED" });
    const completed = orderWith("Completed");
    expect(
      await captureError(
        holdCompletion({ orderId: completed.orderId, reasonCode: "DELIVERY_DISPUTED" }),
      ),
    ).toMatchObject({ status: 409, code: "ORDER_COMPLETION_HOLD_NOT_APPLICABLE" });
  });

  it("gỡ giữ ghi kết quả xác minh; gỡ khi không giữ → 409 NOT_HELD", async () => {
    const order = orderWith("Delivered");
    expect(
      await captureError(releaseCompletionHold({ orderId: order.orderId, note: "Đã giao" })),
    ).toMatchObject({ status: 409, code: "ORDER_COMPLETION_NOT_HELD" });
    await holdCompletion({ orderId: order.orderId, reasonCode: "DELIVERY_DISPUTED" });
    const released = await releaseCompletionHold({
      orderId: order.orderId,
      note: "Hãng xác nhận đã giao",
    });
    expect(released).toMatchObject({ releaseNote: "Hãng xác nhận đã giao" });
    expect(released.releasedAt).not.toBeNull();
    expect(await getCompletionHold(order.orderId)).toBeNull();
  });

  it("không có sales-order-holds:UPDATE → 403", async () => {
    actAs("USER-COORD-01");
    const order = orderWith("Delivered");
    expect(
      await captureError(
        holdCompletion({ orderId: order.orderId, reasonCode: "DELIVERY_DISPUTED" }),
      ),
    ).toMatchObject({ status: 403 });
  });
});
