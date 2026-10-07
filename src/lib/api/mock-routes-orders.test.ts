/**
 * Mock routes đơn hàng — chạy qua axios thật + `features/order/api.ts`, nên kiểm luôn:
 * mock trả đúng hình BE (envelope, OrderResponse, PageResponse trang 0, lỗi `errorCode`)
 * và lớp api parse/map được. `Math.random` cố định 0.05 → không dính lỗi 500 ngẫu nhiên.
 *
 * File nằm ở `src/lib/api/` vì cần `mock-data.ts` để chọn fixture — CI grep chặn import
 * đó trong `src/app|components|features`.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { adminCancelOrder, getOrder, listOrders } from "@/features/order/api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { orders } from "@/lib/mock-data";

import { activateMockAdapter } from "./mock-adapter";
import { resetOrderMockStore } from "./mock-routes-orders";

const originalAdapter = api.defaults.adapter;

function firstOrderWith(status: string) {
  const order = orders.find((o) => o.status === status);
  if (!order) throw new Error(`mock-data không có đơn "${status}"`);
  return order;
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

afterEach(() => resetOrderMockStore());

afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("GET /orders — PageResponse trang từ 0", () => {
  it("page=0&size=5 trả 5 đơn đầu, đã map status BE → FE", async () => {
    const page = await listOrders({ page: 0, size: 5 });

    expect(page.page).toBe(0);
    expect(page.size).toBe(5);
    expect(page.items).toHaveLength(Math.min(5, orders.length));
    expect(page.totalElements).toBe(orders.length);
    expect(page.hasPrevious).toBe(false);
    for (const order of page.items) expect(order.status).not.toMatch(/^[A-Z_]+$/);
  });

  it("lọc status: nhãn FE được dịch sang BE trước khi gửi", async () => {
    const page = await listOrders({ page: 0, size: 200, status: ["Pending Payment"] });

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((o) => o.status === "Pending Payment")).toBe(true);
  });

  it("trang 2 (page=1) nối tiếp trang 1, không trùng đơn", async () => {
    const first = await listOrders({ page: 0, size: 5 });
    const second = await listOrders({ page: 1, size: 5 });

    expect(second.page).toBe(1);
    expect(second.hasPrevious).toBe(true);
    const firstIds = new Set(first.items.map((o) => o.orderId));
    expect(second.items.some((o) => firstIds.has(o.orderId))).toBe(false);
  });

  it("mặc định sắp xếp đơn mới đặt trước; sort=placedAt,asc đảo lại", async () => {
    const desc = await listOrders({ page: 0, size: 200 });
    const asc = await listOrders({ page: 0, size: 200, sort: "placedAt,asc" });
    const times = (list: typeof desc.items) => list.map((o) => new Date(o.placedAt).getTime());

    expect(times(desc.items)).toEqual([...times(desc.items)].sort((a, b) => b - a));
    expect(times(asc.items)).toEqual([...times(asc.items)].sort((a, b) => a - b));
  });

  it("search theo mã đơn lọc phía server, totalElements theo kết quả lọc", async () => {
    const source = orders[0];
    if (!source) throw new Error("mock-data rỗng");

    const page = await listOrders({ page: 0, size: 15, search: source.orderNumber });

    expect(page.items.map((o) => o.orderNumber)).toContain(source.orderNumber);
    expect(page.totalElements).toBe(page.items.length);
    expect(page.totalElements).toBeLessThan(orders.length);
  });
});

describe("GET /orders/:id — OrderResponse", () => {
  it("map người nhận + địa chỉ từ shippingAddress, tiền theo currency", async () => {
    const source = orders[0];
    if (!source) throw new Error("mock-data rỗng");

    const order = await getOrder(source.orderId);

    expect(order).toMatchObject({
      orderId: source.orderId,
      orderNumber: source.orderNumber,
      totalAmount: source.grandTotal,
      currency: source.currency,
      recipientName: source.recipientName,
      recipientPhone: source.recipientPhone,
    });
    expect(order.shippingAddressText).toContain(source.shippingAddress.province);
    expect(order.lines[0]?.sku).toBe(source.lines[0]?.skuId);
  });

  it("đơn không tồn tại → ApiError NOT_FOUND kèm traceId", async () => {
    const error = await captureError(getOrder("ORD-KHONG-TON-TAI"));
    expect(error.status).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.traceId).toBeTruthy();
  });
});

describe("POST /orders/:id/admin-cancellation", () => {
  it("huỷ hợp lệ → thành công; huỷ lần 2 → CONFLICT", async () => {
    const order = firstOrderWith("Pending Payment");

    await expect(adminCancelOrder({ id: order.orderId, reason: "Khách đổi ý" })).resolves.toBe(
      undefined,
    );
    expect((await getOrder(order.orderId)).status).toBe("Cancelled");

    const error = await captureError(adminCancelOrder({ id: order.orderId, reason: "Lần 2" }));
    expect(error.status).toBe(409);
    expect(error.code).toBe("CONFLICT");
  });

  it("thiếu lý do → VALIDATION_FAILED, fieldErrors.reason", async () => {
    const order = firstOrderWith("Pending Payment");
    const error = await captureError(adminCancelOrder({ id: order.orderId, reason: "  " }));

    expect(error.status).toBe(400);
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.fieldErrors?.reason).toBeTruthy();
  });

  it("BE BR-031; docs BR-03: đơn Shipped → CONFLICT", async () => {
    const order = firstOrderWith("Shipped");
    const error = await captureError(adminCancelOrder({ id: order.orderId, reason: "Thử" }));

    expect(error.status).toBe(409);
    expect(error.code).toBe("CONFLICT");
  });

  it("đơn không tồn tại → NOT_FOUND (không tiết lộ quyền)", async () => {
    const error = await captureError(adminCancelOrder({ id: "ORD-KHONG-TON-TAI", reason: "Thử" }));
    expect(error.code).toBe("NOT_FOUND");
  });
});
