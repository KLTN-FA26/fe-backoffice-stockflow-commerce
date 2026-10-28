/**
 * Mock release + hình thức giao (BE PR #157) — chạy qua axios thật + `features/order/api.ts`, nên kiểm luôn mock đúng
 * hình BE và lớp api parse được: mặc định PARCEL, release kèm hình thức (quyền, FTL/COD, nothing released khi lỗi),
 * đổi hình thức (khoá, lịch sử), cờ `deliveryModeLocked`.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getOrder } from "@/features/order/api";
import { changeDeliveryMode, releaseOrder } from "@/features/order/delivery-mode-api";
import { getOrderHistory } from "@/features/order/history-api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";
import { orders } from "@/lib/mock-data";

import { activateMockAdapter } from "./mock-adapter";
import {
  resetOrderMockStore,
  setMockOrderBalancePolicy,
  setMockOrderStatus,
} from "./mock-routes-orders";

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
beforeEach(() => actAs("USER-COORD-01"));
afterEach(() => resetOrderMockStore());
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

const WH = "WH-HN-01";

/**
 * Đơn CỌC thu phần còn lại khi giao (luật BE `ck_order_ftl_no_cod`): mock-data không có đơn cọc, nên đặt cách thu
 * ON_DELIVERY cho một đơn In Production chưa đóng gói (mở khoá hình thức giao).
 */
function codOrder() {
  const order = firstOrderWith("In Production");
  setMockOrderBalancePolicy(order.orderId, "ON_DELIVERY");
  return order;
}

describe("OrderResponse.deliveryMode / deliveryModeLocked", () => {
  it("mặc định PARCEL, mở khoá với đơn Confirmed; khoá với đơn đã giao", async () => {
    const open = await getOrder(firstOrderWith("Confirmed").orderId);
    expect(open).toMatchObject({ deliveryMode: "PARCEL", deliveryModeLocked: false });
    const shipped = await getOrder(firstOrderWith("Delivered").orderId);
    expect(shipped.deliveryModeLocked).toBe(true);
  });
});

describe("POST /orders/:id/release", () => {
  it("không gửi hình thức → giữ PARCEL, đơn sang READY_TO_FULFILL / IN_PRODUCTION, lịch sử không có mục đổi", async () => {
    const order = firstOrderWith("Confirmed");
    await releaseOrder({ id: order.orderId, warehouseId: WH });
    const after = await getOrder(order.orderId);
    expect(["Ready to Fulfill", "In Production"]).toContain(after.status);
    expect(after.deliveryMode).toBe("PARCEL");
    const history = await getOrderHistory(order.orderId);
    expect(history.some((entry) => entry.kind === "delivery-mode")).toBe(false);
  });

  it("kèm FULL_TRUCKLOAD (có quyền) → đổi và ghi lịch sử 'từ PARCEL', người đổi, kèm hình thức", async () => {
    const order = firstOrderWith("Confirmed", "Credit Card");
    await releaseOrder({ id: order.orderId, warehouseId: WH, deliveryMode: "FULL_TRUCKLOAD" });
    expect((await getOrder(order.orderId)).deliveryMode).toBe("FULL_TRUCKLOAD");
    const entry = (await getOrderHistory(order.orderId)).find((e) => e.kind === "delivery-mode");
    expect(entry).toMatchObject({ mode: "FULL_TRUCKLOAD", previousMode: "PARCEL" });
  });

  it("hình thức khác của đơn mà thiếu sales-order-delivery-modes:UPDATE → 403, KHÔNG release gì", async () => {
    actAs("USER-ACC-01");
    const order = firstOrderWith("Confirmed");
    const error = await captureError(
      releaseOrder({ id: order.orderId, warehouseId: WH, deliveryMode: "FULL_TRUCKLOAD" }),
    );
    expect(error.status).toBe(403);
    expect((await getOrder(order.orderId)).status).toBe("Confirmed");
  });

  it("FTL với đơn cọc thu khi giao → 409 DELIVERY_MODE_FTL_NO_COD và đơn vẫn Confirmed (không release gì)", async () => {
    const order = codOrder();
    setMockOrderStatus(order.orderId, "CONFIRMED");
    const error = await captureError(
      releaseOrder({ id: order.orderId, warehouseId: WH, deliveryMode: "FULL_TRUCKLOAD" }),
    );
    expect(error.code).toBe("DELIVERY_MODE_FTL_NO_COD");
    const after = await getOrder(order.orderId);
    expect(after.status).toBe("Confirmed");
    expect(after.deliveryMode).toBe("PARCEL");
  });

  it("thiếu kho → 400; kho lạ → 404 WAREHOUSE_NOT_FOUND; đơn chưa ở CONFIRMED → 409", async () => {
    const confirmed = firstOrderWith("Confirmed");
    expect(
      (await captureError(releaseOrder({ id: confirmed.orderId, warehouseId: "" }))).status,
    ).toBe(400);
    expect(
      (await captureError(releaseOrder({ id: confirmed.orderId, warehouseId: "WH-NOPE" }))).code,
    ).toBe("WAREHOUSE_NOT_FOUND");
    const delivered = firstOrderWith("Delivered");
    expect(
      (await captureError(releaseOrder({ id: delivered.orderId, warehouseId: WH }))).status,
    ).toBe(409);
  });
});

describe("PUT /orders/:id/delivery-mode", () => {
  it("đổi + ghi chú → lịch sử có mục DELIVERY_MODE_CHANGE; đặt lại đúng hình thức hiện tại không ghi gì", async () => {
    const order = firstOrderWith("Confirmed", "Credit Card");
    await changeDeliveryMode({
      id: order.orderId,
      deliveryMode: "FULL_TRUCKLOAD",
      note: "Khách lấy 2 container",
    });
    await changeDeliveryMode({ id: order.orderId, deliveryMode: "FULL_TRUCKLOAD", note: "" });
    const entries = (await getOrderHistory(order.orderId)).filter(
      (e) => e.kind === "delivery-mode",
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      mode: "FULL_TRUCKLOAD",
      previousMode: "PARCEL",
      reason: "Khách lấy 2 container",
      actorName: "Điều phối đơn",
    });
  });

  it("đã khoá (đơn đã đóng gói / giao) → 409 DELIVERY_MODE_LOCKED", async () => {
    const order = firstOrderWith("Delivered");
    const error = await captureError(
      changeDeliveryMode({ id: order.orderId, deliveryMode: "FULL_TRUCKLOAD", note: "" }),
    );
    expect(error.code).toBe("DELIVERY_MODE_LOCKED");
  });

  it("đơn vào PACKED trong phiên → khoá (packedAt)", async () => {
    const order = firstOrderWith("Confirmed", "Credit Card");
    setMockOrderStatus(order.orderId, "PACKED");
    expect((await getOrder(order.orderId)).deliveryModeLocked).toBe(true);
  });

  it("FTL với đơn cọc thu khi giao → 409 FTL_NO_COD; thiếu quyền → 403; ghi chú > 500 → 400", async () => {
    const cod = codOrder();
    expect(
      (
        await captureError(
          changeDeliveryMode({ id: cod.orderId, deliveryMode: "FULL_TRUCKLOAD", note: "" }),
        )
      ).code,
    ).toBe("DELIVERY_MODE_FTL_NO_COD");
    const order = firstOrderWith("Confirmed", "Credit Card");
    expect(
      (
        await captureError(
          changeDeliveryMode({
            id: order.orderId,
            deliveryMode: "FULL_TRUCKLOAD",
            note: "x".repeat(501),
          }),
        )
      ).status,
    ).toBe(400);
    actAs("USER-SALE-01");
    expect(
      (
        await captureError(
          changeDeliveryMode({ id: order.orderId, deliveryMode: "FULL_TRUCKLOAD", note: "" }),
        )
      ).status,
    ).toBe(403);
  });
});

describe("luật FTL + COD của BE: chỉ đơn CỌC có cách thu ON_DELIVERY", () => {
  it("phương thức thanh toán 'COD' của mock-data KHÔNG chặn FTL (đó là cách khách trả, không phải cách thu phần còn lại)", async () => {
    const order = firstOrderWith("In Production", "COD");
    await changeDeliveryMode({ id: order.orderId, deliveryMode: "FULL_TRUCKLOAD", note: "" });
    expect((await getOrder(order.orderId)).deliveryMode).toBe("FULL_TRUCKLOAD");
  });

  it("đơn cọc thu trước khi giao / ghi công nợ → FTL được; chỉ ON_DELIVERY bị 409; OrderResponse phản ánh đơn cọc", async () => {
    const order = firstOrderWith("In Production");
    for (const policy of ["BEFORE_DELIVERY", "ON_CREDIT"] as const) {
      setMockOrderBalancePolicy(order.orderId, policy);
      const view = await getOrder(order.orderId);
      expect(view).toMatchObject({ paymentTerm: "DEPOSIT", balancePolicy: policy });
      await changeDeliveryMode({ id: order.orderId, deliveryMode: "FULL_TRUCKLOAD", note: "" });
      await changeDeliveryMode({ id: order.orderId, deliveryMode: "PARCEL", note: "" });
    }
    setMockOrderBalancePolicy(order.orderId, "ON_DELIVERY");
    expect(
      (
        await captureError(
          changeDeliveryMode({ id: order.orderId, deliveryMode: "FULL_TRUCKLOAD", note: "" }),
        )
      ).code,
    ).toBe("DELIVERY_MODE_FTL_NO_COD");
  });

  it("đơn trả trước (không phải đơn cọc) không có cách thu phần còn lại", async () => {
    const view = await getOrder(firstOrderWith("Confirmed", "Credit Card").orderId);
    expect(view).toMatchObject({ paymentTerm: "PREPAID", balancePolicy: null });
  });
});
