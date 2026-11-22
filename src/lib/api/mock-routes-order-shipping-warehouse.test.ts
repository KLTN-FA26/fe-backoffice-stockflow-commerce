/**
 * Mock kho xuất của đơn (BE `ShippingWarehouseController`, docs 17 §4.2 bước 2-3, BR-22, BR-25) — chạy qua axios thật +
 * `features/order/shipping-warehouse-api.ts`, nên kiểm luôn mock đúng hình BE và lớp api parse được: quyền READ / UPDATE,
 * chọn kho giữ phần có sẵn, kho lạ → 404, đơn không phải Đã xác nhận → 409, đổi kho sau khi đã giữ hàng → 409.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  chooseShippingWarehouse,
  getShippingCoverage,
  getShippingWarehouseOptions,
} from "@/features/order/shipping-warehouse-api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";
import { orders, warehouses } from "@/lib/mock-data";

import { activateMockAdapter } from "./mock-adapter";
import { resetOrderMockStore } from "./mock-routes-orders";

const originalAdapter = api.defaults.adapter;

const firstOrderWith = (status: string) => {
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
// SALES_STAFF (demo USER-SALE-01) có sales-order-shipping-warehouses:READ + UPDATE
beforeEach(() => actAs("USER-SALE-01"));
afterEach(() => resetOrderMockStore());
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

const activeByCode = () =>
  warehouses.filter((w) => w.active).sort((a, b) => a.code.localeCompare(b.code));

/** Mã kho thứ `rank` (theo mã kho) — thứ tự gợi ý của mock. */
function warehouseAt(rank: number) {
  const warehouse = activeByCode()[rank];
  if (!warehouse) throw new Error(`mock-data cần ít nhất ${rank + 1} kho hoạt động`);
  return warehouse;
}

describe("GET /orders/:id/shipping-warehouse/options + /stock-coverage", () => {
  it("các kho đang hoạt động theo thứ tự gợi ý, kho đầu đủ hàng; chưa chọn kho → coverage chưa giữ gì", async () => {
    const order = firstOrderWith("Confirmed");
    const options = await getShippingWarehouseOptions(order.orderId);
    expect(options.chosenWarehouseId).toBeUndefined();
    expect(options.warehouses.map((w) => w.warehouseCode)).toEqual(
      activeByCode().map((w) => w.code),
    );
    expect(options.warehouses[0]?.holdsEveryLine).toBe(true);
    expect(options.warehouses[1]?.holdsEveryLine).toBe(false);
    const coverage = await getShippingCoverage(order.orderId);
    expect(coverage.warehouseId).toBeUndefined();
    expect(coverage.fullyHeld).toBe(false);
  });

  it("thiếu sales-order-shipping-warehouses:READ (Kế toán) → 403", async () => {
    actAs("USER-ACC-01");
    const order = firstOrderWith("Confirmed");
    expect((await captureError(getShippingWarehouseOptions(order.orderId))).status).toBe(403);
    expect((await captureError(getShippingCoverage(order.orderId))).status).toBe(403);
  });

  it("đơn lạ → 404", async () => {
    expect((await captureError(getShippingWarehouseOptions("NOPE"))).status).toBe(404);
  });
});

describe("PUT /orders/:id/shipping-warehouse", () => {
  it("chọn kho đầu → giữ đủ; đã giữ hàng thì đổi kho → 409 (BR-22); coverage và options phản ánh kho đã chọn", async () => {
    const order = firstOrderWith("Confirmed");
    const first = warehouseAt(0);
    const second = warehouseAt(1);
    const full = await chooseShippingWarehouse({
      orderId: order.orderId,
      warehouseId: first.warehouseId,
    });
    expect(full).toMatchObject({ warehouseCode: first.code, fullyHeld: true });

    // Đã giữ hàng ở kho đầu: chưa nhả thì đổi kho → 409 (BR-22)
    expect(
      await captureError(
        chooseShippingWarehouse({ orderId: order.orderId, warehouseId: second.warehouseId }),
      ),
    ).toMatchObject({ status: 409, code: "ORDER_SHIPPING_WAREHOUSE_LOCKED" });

    expect((await getShippingCoverage(order.orderId)).warehouseCode).toBe(first.code);
    expect((await getShippingWarehouseOptions(order.orderId)).chosenWarehouseId).toBe(
      first.warehouseId,
    );
  });

  it("kho không có hàng thì chọn được và chưa giữ thùng nào; sau đó đổi sang kho khác được (chưa giữ gì)", async () => {
    const order = firstOrderWith("Confirmed");
    const third = warehouseAt(2);
    const none = await chooseShippingWarehouse({
      orderId: order.orderId,
      warehouseId: third.warehouseId,
    });
    expect(none.fullyHeld).toBe(false);
    expect(none.lines.every((line) => line.heldCartons === 0)).toBe(true);
    const first = warehouseAt(0);
    expect(
      (await chooseShippingWarehouse({ orderId: order.orderId, warehouseId: first.warehouseId }))
        .fullyHeld,
    ).toBe(true);
  });

  it("thiếu sales-order-shipping-warehouses:UPDATE (Kế toán) → 403, không chọn gì", async () => {
    actAs("USER-ACC-01");
    const order = firstOrderWith("Confirmed");
    const warehouseId = warehouseAt(0).warehouseId;
    expect(
      (await captureError(chooseShippingWarehouse({ orderId: order.orderId, warehouseId }))).status,
    ).toBe(403);
  });

  it("thiếu kho → 400; kho lạ → 404 WAREHOUSE_NOT_FOUND; đơn không phải Đã xác nhận → 409 ORDER_SHIPPING_WAREHOUSE_NOT_ALLOWED", async () => {
    const confirmed = firstOrderWith("Confirmed");
    expect(
      (await captureError(chooseShippingWarehouse({ orderId: confirmed.orderId, warehouseId: "" })))
        .status,
    ).toBe(400);
    expect(
      (
        await captureError(
          chooseShippingWarehouse({ orderId: confirmed.orderId, warehouseId: "WH-NOPE" }),
        )
      ).code,
    ).toBe("WAREHOUSE_NOT_FOUND");
    const delivered = firstOrderWith("Delivered");
    expect(
      await captureError(
        chooseShippingWarehouse({
          orderId: delivered.orderId,
          warehouseId: warehouseAt(0).warehouseId,
        }),
      ),
    ).toMatchObject({ status: 409, code: "ORDER_SHIPPING_WAREHOUSE_NOT_ALLOWED" });
  });
});
