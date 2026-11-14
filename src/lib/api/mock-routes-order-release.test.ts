/**
 * Mock release + lịch giao (BE `OrderReleaseController` / `DeliveryBatchController`, docs 17 §4.2, §4.5) — chạy qua axios
 * thật + `features/order/*-api.ts`, nên kiểm luôn mock đúng hình BE và lớp api parse được: quyền
 * `sales-order-releases:UPDATE`, đơn CONFIRMED → READY_TO_FULFILL, đợt giao sai → 409/404, OrderResponse không còn hình
 * thức giao, lịch giao cần `sales-contracts:READ`.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getOrder } from "@/features/order/api";
import { getDeliverySchedule } from "@/features/order/delivery-batch-api";
import { getOrderHistory } from "@/features/order/history-api";
import { releaseOrder } from "@/features/order/release-api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";
import { orders } from "@/lib/mock-data";

import { activateMockAdapter } from "./mock-adapter";
import { resetOrderMockStore, setMockOrderBalancePolicy } from "./mock-routes-orders";
import { mockBatchIdOf } from "./mock-routes-order-release";

const originalAdapter = api.defaults.adapter;

const firstOrderWith = (status: string, paymentMethodType?: string) => {
  const order = orders.find(
    (o) =>
      o.status === status &&
      (paymentMethodType === undefined || o.paymentMethodType === paymentMethodType),
  );
  if (!order) throw new Error(`mock-data không có đơn "${status}" ${paymentMethodType ?? ""}`);
  return order;
};

/** Đăng nhập tài khoản demo: quyền lấy từ `mock-user-grants` (cùng nguồn `/identity/me/permissions`). */
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
// Admin có sales-order-releases:UPDATE; USER-COORD-01 (vai đã giải thể) cũng giữ toàn bộ mã đơn bán
beforeEach(() => actAs("USER-ADMIN-01"));
afterEach(() => resetOrderMockStore());
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

const WH = "WH-HN-01";

describe("OrderResponse — không còn hình thức giao (BE bỏ, docs 17 BR-16)", () => {
  it("đơn trả về không có deliveryMode / deliveryModeLocked", async () => {
    const order = await getOrder(firstOrderWith("Confirmed").orderId);
    expect(order.deliveryMode).toBeNull();
    expect(order.deliveryModeLocked).toBeNull();
  });

  it("lịch sử đơn không còn mục đổi hình thức giao", async () => {
    const id = firstOrderWith("Confirmed").orderId;
    await releaseOrder({ id, warehouseId: WH });
    expect((await getOrderHistory(id)).some((entry) => entry.kind === "delivery-mode")).toBe(false);
  });
});

describe("POST /orders/:id/release", () => {
  it("đơn CONFIRMED → READY_TO_FULFILL (không còn IN_PRODUCTION), ghi kho xuất", async () => {
    const order = firstOrderWith("Confirmed");
    await releaseOrder({ id: order.orderId, warehouseId: WH });
    const after = await getOrder(order.orderId);
    expect(after.status).toBe("Ready to Fulfill");
    expect(after.warehouseId).toBe(WH);
  });

  it("đợt giao kế tiếp (đợt 1) được nhận; đợt lạ → 404 DELIVERY_BATCH_NOT_FOUND và KHÔNG release gì", async () => {
    const order = firstOrderWith("Confirmed");
    const error = await captureError(
      releaseOrder({ id: order.orderId, warehouseId: WH, deliveryBatchId: "BATCH-LA" }),
    );
    expect(error).toMatchObject({ status: 404, code: "DELIVERY_BATCH_NOT_FOUND" });
    expect((await getOrder(order.orderId)).status).toBe("Confirmed");
    await releaseOrder({
      id: order.orderId,
      warehouseId: WH,
      deliveryBatchId: mockBatchIdOf(order),
    });
    expect((await getOrder(order.orderId)).status).toBe("Ready to Fulfill");
  });

  it("thiếu sales-order-releases:UPDATE (Kế toán, Sales) → 403, KHÔNG release gì", async () => {
    for (const userId of ["USER-ACC-01", "USER-SALE-01"]) {
      actAs(userId);
      const order = firstOrderWith("Confirmed");
      const error = await captureError(releaseOrder({ id: order.orderId, warehouseId: WH }));
      expect(error.status).toBe(403);
      expect((await getOrder(order.orderId)).status).toBe("Confirmed");
    }
  });

  it("thiếu kho → 400; kho lạ → 404 WAREHOUSE_NOT_FOUND; đơn chưa ở CONFIRMED → 409 ORDER_INVALID_TRANSITION", async () => {
    const confirmed = firstOrderWith("Confirmed");
    expect(
      (await captureError(releaseOrder({ id: confirmed.orderId, warehouseId: "" }))).status,
    ).toBe(400);
    expect(
      (await captureError(releaseOrder({ id: confirmed.orderId, warehouseId: "WH-NOPE" }))).code,
    ).toBe("WAREHOUSE_NOT_FOUND");
    const delivered = firstOrderWith("Delivered");
    expect(
      await captureError(releaseOrder({ id: delivered.orderId, warehouseId: WH })),
    ).toMatchObject({ status: 409, code: "ORDER_INVALID_TRANSITION" });
  });

  it("body cũ có deliveryMode vẫn được nhận như BE (field lạ bị bỏ qua) — nhưng FE không còn gửi", async () => {
    const order = firstOrderWith("Confirmed");
    await api.post(`/orders/${order.orderId}/release`, {
      warehouseId: WH,
      deliveryMode: "FULL_TRUCKLOAD",
    });
    expect((await getOrder(order.orderId)).status).toBe("Ready to Fulfill");
  });
});

describe("GET /orders/:id/delivery-batches", () => {
  it("cần sales-contracts:READ: Sales / admin đọc được, quản lý kho theo seed BE (không có mã) → 403", async () => {
    const order = firstOrderWith("Confirmed");
    actAs("USER-SALE-01");
    const schedule = await getDeliverySchedule(order.orderId);
    expect(schedule.batches).toHaveLength(1);
    expect(schedule.batches[0]).toMatchObject({
      batchId: mockBatchIdOf(order),
      seq: 1,
      state: "READY",
    });
    expect(schedule.batches[0]?.releasedAt).toBeUndefined();
    // USER-WH-01 mô phỏng nhân viên kho không có sales-contracts:READ
    actAs("USER-WH-01");
    expect((await captureError(getDeliverySchedule(order.orderId))).status).toBe(403);
  });

  it("đơn đã release: đợt 1 có releasedAt, trạng thái hiển thị IN_DELIVERY", async () => {
    const order = firstOrderWith("Confirmed");
    await releaseOrder({ id: order.orderId, warehouseId: WH });
    const batch = (await getDeliverySchedule(order.orderId)).batches[0];
    expect(batch?.state).toBe("IN_DELIVERY");
    expect(batch?.releasedAt).toBeTruthy();
  });
});

describe("OrderResponse đơn cọc (cách thu phần còn lại)", () => {
  it("đơn cọc thu trước khi giao / ghi công nợ / thu khi giao phản ánh đúng paymentTerm + balancePolicy", async () => {
    const order = firstOrderWith("In Production");
    for (const policy of ["BEFORE_DELIVERY", "ON_CREDIT", "ON_DELIVERY"] as const) {
      setMockOrderBalancePolicy(order.orderId, policy);
      expect(await getOrder(order.orderId)).toMatchObject({
        paymentTerm: "DEPOSIT",
        balancePolicy: policy,
      });
    }
  });

  it("đơn trả trước (không phải đơn cọc) không có cách thu phần còn lại", async () => {
    const view = await getOrder(firstOrderWith("Confirmed", "Credit Card").orderId);
    expect(view).toMatchObject({ paymentTerm: "PREPAID", balancePolicy: null });
  });
});
