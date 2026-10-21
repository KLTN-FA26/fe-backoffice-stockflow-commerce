/**
 * Mock routes đơn hàng — chạy qua axios thật + `features/order/api.ts`, nên kiểm luôn:
 * mock trả đúng hình BE (envelope, OrderResponse, PageResponse trang 0, lỗi `errorCode`)
 * và lớp api parse/map được. `Math.random` cố định 0.05 → không dính lỗi 500 ngẫu nhiên.
 *
 * File nằm ở `src/lib/api/` vì cần `mock-data.ts` để chọn fixture — CI grep chặn import
 * đó trong `src/app|components|features`.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  adminCancelOrder,
  closeOrderRemainder,
  decidePartialShipment,
  getOrder,
  getOrderHistory,
  holdOrder,
  listOrders,
  recordDeliveryFailure,
  resolveOrderHold,
} from "@/features/order/api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { orders } from "@/lib/mock-data";

import { activateMockAdapter } from "./mock-adapter";
import { resetOrderMockStore, setMockOrderStatus } from "./mock-routes-orders";

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
  it("huỷ hợp lệ → thành công; huỷ lần 2 → ORDER_CANCELLED", async () => {
    const order = firstOrderWith("Pending Payment");

    await expect(adminCancelOrder({ id: order.orderId, reason: "Khách đổi ý" })).resolves.toBe(
      undefined,
    );
    expect((await getOrder(order.orderId)).status).toBe("Cancelled");

    const error = await captureError(adminCancelOrder({ id: order.orderId, reason: "Lần 2" }));
    expect(error.status).toBe(409);
    expect(error.code).toBe("ORDER_CANCELLED");
  });

  it("thiếu lý do → VALIDATION_FAILED, fieldErrors.reason", async () => {
    const order = firstOrderWith("Pending Payment");
    const error = await captureError(adminCancelOrder({ id: order.orderId, reason: "  " }));

    expect(error.status).toBe(400);
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.fieldErrors?.reason).toBeTruthy();
  });

  it("BR-ORD-004: đã đóng gói (packedAt) → ORDER_NOT_CANCELLABLE, kể cả Shipped", async () => {
    const packed = firstOrderWith("Packed");
    const packedError = await captureError(adminCancelOrder({ id: packed.orderId, reason: "Thử" }));
    expect(packedError.status).toBe(409);
    expect(packedError.code).toBe("ORDER_NOT_CANCELLABLE");

    const shipped = firstOrderWith("Shipped");
    const shippedError = await captureError(
      adminCancelOrder({ id: shipped.orderId, reason: "Thử" }),
    );
    expect(shippedError.code).toBe("ORDER_NOT_CANCELLABLE");
  });

  it("đơn không tồn tại → NOT_FOUND (không tiết lộ quyền)", async () => {
    const error = await captureError(adminCancelOrder({ id: "ORD-KHONG-TON-TAI", reason: "Thử" }));
    expect(error.code).toBe("NOT_FOUND");
  });
});

describe("GET /orders — bộ lọc status (BE PR #133)", () => {
  it("lọc trạng thái mới: PARTIALLY_FULFILLED, ON_HOLD, DELIVERY_FAILED, CLOSED", async () => {
    const page = await listOrders({
      page: 0,
      size: 200,
      status: ["Partially Fulfilled", "On Hold", "Delivery Failed", "Closed"],
    });
    expect(new Set(page.items.map((o) => o.status))).toEqual(
      new Set(["Partially Fulfilled", "On Hold", "Delivery Failed", "Closed"]),
    );
  });

  it("tên cũ BE còn nhận một sprint: IN_FULFILMENT → PICKING/PARTIALLY_FULFILLED/PACKED, PAID → CONFIRMED", async () => {
    const { data } = await api.get<{
      data?: { items: { status: string }[] };
      items?: { status: string }[];
    }>("/orders", {
      params: new URLSearchParams([
        ["page", "0"],
        ["size", "200"],
        ["status", "IN_FULFILMENT"],
      ]),
    });
    const items = data.items ?? data.data?.items ?? [];
    expect(new Set(items.map((o) => o.status))).toEqual(
      new Set(["PICKING", "PARTIALLY_FULFILLED", "PACKED"]),
    );
  });

  it("omit null (non_null): đơn không giữ không có key holdReason / shipments", async () => {
    const source = firstOrderWith("Pending Payment");
    const { data } = await api.get<Record<string, unknown>>(`/orders/${source.orderId}`);
    const body = ("data" in data && typeof data.data === "object" ? data.data : data) as Record<
      string,
      unknown
    >;
    expect(body).not.toHaveProperty("holdReason");
    expect(body).not.toHaveProperty("shipments");
    expect(body).not.toHaveProperty("packedAt");
    expect(body).toHaveProperty("effectiveTotal");
  });
});

describe("POST /orders/:id/hold + hold/resolution", () => {
  it("giữ đơn Confirmed → ON_HOLD, nhớ trạng thái trước; gỡ giữ về đúng chỗ cũ", async () => {
    const order = firstOrderWith("Confirmed");
    await holdOrder({ id: order.orderId, reasonCode: "ADDRESS", note: "Sai phường" });

    const held = await getOrder(order.orderId);
    expect(held).toMatchObject({
      status: "On Hold",
      holdReason: "ADDRESS",
      holdNote: "Sai phường",
      statusBeforeHold: "Confirmed",
    });

    // Giữ lần hai → ORDER_INVALID_TRANSITION
    const again = await captureError(
      holdOrder({ id: order.orderId, reasonCode: "FRAUD", note: "" }),
    );
    expect(again.code).toBe("ORDER_INVALID_TRANSITION");

    await resolveOrderHold({ id: order.orderId, note: "Khách xác nhận" });
    const resolved = await getOrder(order.orderId);
    expect(resolved.status).toBe("Confirmed");
    expect(resolved.holdReason).toBeNull();

    const notOnHold = await captureError(resolveOrderHold({ id: order.orderId, note: "x" }));
    expect(notOnHold.code).toBe("ORDER_NOT_ON_HOLD");
  });

  it("OTHER không có ghi chú → 400; lý do của hệ thống (CREDIT) → 400; đơn Delivered → ORDER_INVALID_TRANSITION", async () => {
    const order = firstOrderWith("Confirmed");
    const other = await captureError(
      holdOrder({ id: order.orderId, reasonCode: "OTHER", note: "" }),
    );
    expect(other.status).toBe(400);
    expect(other.code).toBe("VALIDATION_FAILED");
    const credit = await captureError(
      holdOrder({ id: order.orderId, reasonCode: "CREDIT" as never, note: "" }),
    );
    expect(credit.status).toBe(400);

    const delivered = firstOrderWith("Delivered");
    const invalid = await captureError(
      holdOrder({ id: delivered.orderId, reasonCode: "FRAUD", note: "" }),
    );
    expect(invalid.code).toBe("ORDER_INVALID_TRANSITION");
  });

  it("đơn On Hold seed (ADDRESS) gỡ giữ được; ghi chú gỡ giữ bắt buộc", async () => {
    const order = firstOrderWith("On Hold");
    const view = await getOrder(order.orderId);
    expect(view).toMatchObject({ holdReason: "ADDRESS", statusBeforeHold: "Picking" });

    const blank = await captureError(resolveOrderHold({ id: order.orderId, note: "  " }));
    expect(blank.status).toBe(400);
    await resolveOrderHold({ id: order.orderId, note: "ok" });
    expect((await getOrder(order.orderId)).status).toBe("Picking");
  });
});

describe("POST /orders/:id/delivery-failure", () => {
  it("đơn Shipped chưa chia lô → DELIVERY_FAILED kèm lý do; OTHER cần ghi chú", async () => {
    const order = firstOrderWith("Shipped");
    const other = await captureError(
      recordDeliveryFailure({ id: order.orderId, reasonCode: "OTHER", note: "" }),
    );
    expect(other.code).toBe("VALIDATION_FAILED");

    await recordDeliveryFailure({ id: order.orderId, reasonCode: "REFUSED", note: "" });
    expect(await getOrder(order.orderId)).toMatchObject({
      status: "Delivery Failed",
      deliveryFailureReason: "REFUSED",
    });
  });

  it("đơn đã chia lô → 409 ORDER_DELIVERY_VIA_SHIPMENT; đơn Delivered → ORDER_INVALID_TRANSITION", async () => {
    const partial = firstOrderWith("Partially Fulfilled");
    const viaShipment = await captureError(
      recordDeliveryFailure({ id: partial.orderId, reasonCode: "LOST", note: "" }),
    );
    expect(viaShipment.code).toBe("ORDER_DELIVERY_VIA_SHIPMENT");

    const delivered = firstOrderWith("Delivered");
    const invalid = await captureError(
      recordDeliveryFailure({ id: delivered.orderId, reasonCode: "LOST", note: "" }),
    );
    expect(invalid.code).toBe("ORDER_INVALID_TRANSITION");
  });
});

describe("POST /orders/:id/remainder-closure", () => {
  it("đơn giao một phần: đóng phần chưa giao, đơn theo lô (Shipped), effectiveTotal giảm", async () => {
    const source = firstOrderWith("Partially Fulfilled");
    const before = await getOrder(source.orderId);
    expect(before.shipments).toHaveLength(1);
    expect(before.lines[0]?.shippedQuantity).toBeGreaterThan(0);

    await closeOrderRemainder({ id: source.orderId, reasonCode: "OUT_OF_STOCK", note: "" });

    const after = await getOrder(source.orderId);
    expect(after.status).toBe("Shipped");
    expect(after.lines[0]?.cancelledQuantity).toBeGreaterThan(0);
    expect(after.effectiveTotal).toBeLessThan(before.totalAmount);

    // Đóng lần hai: đơn không còn PARTIALLY_FULFILLED
    const again = await captureError(
      closeOrderRemainder({ id: source.orderId, reasonCode: "OUT_OF_STOCK", note: "" }),
    );
    expect(again.code).toBe("ORDER_INVALID_TRANSITION");
  });

  it("đơn không giao một phần → ORDER_INVALID_TRANSITION; OTHER thiếu ghi chú → 400", async () => {
    const shipped = firstOrderWith("Shipped");
    const invalid = await captureError(
      closeOrderRemainder({ id: shipped.orderId, reasonCode: "OUT_OF_STOCK", note: "" }),
    );
    expect(invalid.code).toBe("ORDER_INVALID_TRANSITION");

    const partial = firstOrderWith("Partially Fulfilled");
    const noNote = await captureError(
      closeOrderRemainder({ id: partial.orderId, reasonCode: "OTHER", note: "" }),
    );
    expect(noNote.status).toBe(400);
  });
});

describe("OrderResponse — hình dạng thật của BE (số liệu luôn được gửi)", () => {
  async function rawOrder(orderId: string): Promise<Record<string, unknown>> {
    const { data } = await api.get<Record<string, unknown>>(`/orders/${orderId}`);
    return ("data" in data && typeof data.data === "object" ? data.data : data) as Record<
      string,
      unknown
    >;
  }

  it("dòng hàng luôn có shippedQuantity / deliveredQuantity / cancelledQuantity = 0 khi chưa có lô", async () => {
    const body = await rawOrder(firstOrderWith("Confirmed").orderId);
    const [line] = body.lines as Record<string, unknown>[];
    expect(line).toMatchObject({ shippedQuantity: 0, deliveredQuantity: 0, cancelledQuantity: 0 });
  });

  it("billedAmount = 0 luôn được gửi; amountDue tính từ tổng đơn kể cả đơn đã huỷ; amountDueBeforeHandover theo paymentTerm", async () => {
    const cancelled = firstOrderWith("Cancelled");
    const body = await rawOrder(cancelled.orderId);
    expect(body).toMatchObject({ billedAmount: 0, paymentTerm: "PREPAID" });
    expect(body.amountDue).toBe(Math.max(0, cancelled.grandTotal - cancelled.amountPaid));
    expect(body.amountDueBeforeHandover).toBe(body.amountDue);
  });

  it("packedAt có với đơn đã đóng gói (Packed, Partially Fulfilled, Shipped…), không có với đơn đang lấy hàng", async () => {
    for (const status of ["Packed", "Partially Fulfilled", "Shipped", "Delivered"]) {
      expect(await rawOrder(firstOrderWith(status).orderId)).toHaveProperty("packedAt");
    }
    for (const status of ["Picking", "Confirmed", "On Hold"]) {
      expect(await rawOrder(firstOrderWith(status).orderId)).not.toHaveProperty("packedAt");
    }
  });

  it("đơn giữ từ PACKED / PARTIALLY_FULFILLED giữ packedAt và không huỷ được (ORDER_NOT_CANCELLABLE)", async () => {
    for (const status of ["Packed", "Partially Fulfilled"]) {
      const order = firstOrderWith(status);
      await holdOrder({ id: order.orderId, reasonCode: "FRAUD", note: "" });
      expect(await rawOrder(order.orderId)).toMatchObject({
        status: "ON_HOLD",
        packedAt: expect.any(String),
      });
      const error = await captureError(adminCancelOrder({ id: order.orderId, reason: "Thử" }));
      expect(error.code).toBe("ORDER_NOT_CANCELLABLE");
    }
  });

  it("đơn giữ từ PICKING (chưa đóng gói) vẫn huỷ được", async () => {
    const order = firstOrderWith("Picking");
    await holdOrder({ id: order.orderId, reasonCode: "FRAUD", note: "" });
    await expect(adminCancelOrder({ id: order.orderId, reason: "Gian lận" })).resolves.toBe(
      undefined,
    );
  });

  it("đơn vào PACKED qua mock xuất kho được đóng dấu packedAt", async () => {
    const order = firstOrderWith("Ready to Fulfill");
    expect(await rawOrder(order.orderId)).not.toHaveProperty("packedAt");
    setMockOrderStatus(order.orderId, "PACKED");
    expect(await rawOrder(order.orderId)).toHaveProperty("packedAt");
  });
});

describe("PUT /orders/:id/partial-shipment + GET /orders/:id/history (BE PR #150)", () => {
  it("mặc định theo BE: chỉ đơn đang giao từng phần là true; còn lại false", async () => {
    const partial = await getOrder(firstOrderWith("Partially Fulfilled").orderId);
    const picking = await getOrder(firstOrderWith("Picking").orderId);
    expect(partial.allowPartialShipment).toBe(true);
    expect(picking.allowPartialShipment).toBe(false);
  });

  it("bật rồi tắt: cờ đổi, lịch sử có hai mục PARTIAL_SHIPMENT_DECISION kèm ghi chú và người quyết", async () => {
    const source = firstOrderWith("Picking");
    await decidePartialShipment({ id: source.orderId, allowed: true, note: "Khách đồng ý" });
    expect((await getOrder(source.orderId)).allowPartialShipment).toBe(true);
    await decidePartialShipment({ id: source.orderId, allowed: false, note: "" });
    expect((await getOrder(source.orderId)).allowPartialShipment).toBe(false);

    const history = await getOrderHistory(source.orderId);
    expect(history.map((entry) => entry.kind)).toEqual([
      "status-change",
      "partial-shipment",
      "partial-shipment",
    ]);
    expect(history[1]).toMatchObject({ allowed: true, reason: "Khách đồng ý" });
    expect(history[1]?.actorName).toBeTruthy();
    expect(history[2]).toMatchObject({ allowed: false, reason: null });
  });

  it("quyết định không đổi gì (bật khi đã bật) → BE không ghi vào lịch sử", async () => {
    const source = firstOrderWith("Picking");
    await decidePartialShipment({ id: source.orderId, allowed: false, note: "" });
    expect(await getOrderHistory(source.orderId)).toHaveLength(1);
  });

  it("đơn đã SHIPPED → 409 ORDER_PARTIAL_SHIPMENT_LOCKED; thiếu allowed → 400; note > 500 → 400", async () => {
    const shipped = await captureError(
      decidePartialShipment({ id: firstOrderWith("Shipped").orderId, allowed: true, note: "" }),
    );
    expect(shipped).toMatchObject({ status: 409, code: "ORDER_PARTIAL_SHIPMENT_LOCKED" });

    const picking = firstOrderWith("Picking");
    const noAllowed = await captureError(
      api.put(`/orders/${picking.orderId}/partial-shipment`, {}),
    );
    expect(noAllowed.status).toBe(400);
    const longNote = await captureError(
      decidePartialShipment({ id: picking.orderId, allowed: true, note: "a".repeat(501) }),
    );
    expect(longNote.status).toBe(400);
  });

  it("đơn không tồn tại → 404", async () => {
    const missing = await captureError(
      decidePartialShipment({ id: "KHONG-CO", allowed: true, note: "" }),
    );
    expect(missing.status).toBe(404);
  });
});

describe("OrderResponse — printLinesReady / balancePolicy (BE PR #150)", () => {
  it("đơn có dòng in đang IN_PRODUCTION → printLinesReady=false; đơn không in → true", async () => {
    const printed = orders.find((o) => o.lines.some((line) => line.designId));
    const plain = orders.find((o) => !o.lines.some((line) => line.designId));
    if (!printed || !plain) throw new Error("mock-data thiếu đơn in / đơn thường");
    setMockOrderStatus(printed.orderId, "IN_PRODUCTION");
    setMockOrderStatus(plain.orderId, "IN_PRODUCTION");
    expect((await getOrder(printed.orderId)).printLinesReady).toBe(false);
    expect((await getOrder(plain.orderId)).printLinesReady).toBe(true);
  });

  it("đơn trả trước: balancePolicy và creditTermDays là null (chỉ đơn cọc có cách thu phần còn lại)", async () => {
    const prepaid = orders.find((o) => o.paymentMethodType !== "Deposit");
    if (!prepaid) throw new Error("mock-data thiếu đơn trả trước");
    expect(await getOrder(prepaid.orderId)).toMatchObject({
      balancePolicy: null,
      creditTermDays: null,
    });
  });
});

describe("POST /orders/:id/remainder-closure — agreedFee (BE PR #150)", () => {
  const fee = (amount: number) => ({ amount, reason: "Đã in 2 lô", detail: "Khách đồng ý" });

  it("phí ≤ giá trị phần hàng in bị đóng → 200, đơn đóng phần còn lại", async () => {
    const source = firstOrderWith("Partially Fulfilled");
    // ORD-2026-0009: 6 áo in, giao 4 → còn 2 × 149.000 = 298.000
    await closeOrderRemainder({
      id: source.orderId,
      reasonCode: "CUSTOMER_REQUEST",
      note: "",
      agreedFee: fee(298_000),
    });
    expect((await getOrder(source.orderId)).status).toBe("Shipped");
  });

  it("phí vượt giá trị hàng in bị đóng → 400, đơn không đổi", async () => {
    const source = firstOrderWith("Partially Fulfilled");
    const refused = await captureError(
      closeOrderRemainder({
        id: source.orderId,
        reasonCode: "CUSTOMER_REQUEST",
        note: "",
        agreedFee: fee(298_001),
      }),
    );
    expect(refused).toMatchObject({ status: 400, code: "VALIDATION_FAILED" });
    expect((await getOrder(source.orderId)).status).toBe("Partially Fulfilled");
  });

  it("đơn chưa in (không có dòng in) → 409 CANCELLATION_FEE_BEFORE_PRINTING", async () => {
    const plain = orders.find((o) => !o.lines.some((line) => line.designId));
    if (!plain) throw new Error("mock-data thiếu đơn không in");
    setMockOrderStatus(plain.orderId, "PARTIALLY_FULFILLED");
    const refused = await captureError(
      closeOrderRemainder({
        id: plain.orderId,
        reasonCode: "CUSTOMER_REQUEST",
        note: "",
        agreedFee: fee(1000),
      }),
    );
    expect(refused).toMatchObject({ status: 409, code: "CANCELLATION_FEE_BEFORE_PRINTING" });
  });

  it("số tiền không nguyên / thiếu lý do hoặc chi tiết → 400", async () => {
    const source = firstOrderWith("Partially Fulfilled");
    for (const agreedFee of [
      { ...fee(1000), amount: 10.5 },
      { ...fee(1000), reason: "" },
      { ...fee(1000), detail: " " },
    ]) {
      const refused = await captureError(
        closeOrderRemainder({
          id: source.orderId,
          reasonCode: "OUT_OF_STOCK",
          note: "",
          agreedFee,
        }),
      );
      expect(refused.status).toBe(400);
    }
  });
});

describe("POST /orders/:id/admin-cancellation — hàng có sẵn đóng trước hàng in (BE PR #150)", () => {
  it("IN_PRODUCTION đã đóng sẵn, chưa lô nào đi → huỷ được; PACKED → vẫn ORDER_NOT_CANCELLABLE", async () => {
    const [first, second] = orders.filter((o) =>
      ["Picking", "In Production", "Ready to Fulfill"].includes(o.status),
    );
    if (!first || !second) throw new Error("mock-data thiếu hai đơn đang trong khâu kho");
    setMockOrderStatus(first.orderId, "PACKED");
    setMockOrderStatus(first.orderId, "IN_PRODUCTION");
    await adminCancelOrder({ id: first.orderId, reason: "Khách huỷ" });
    expect((await getOrder(first.orderId)).status).toBe("Cancelled");

    setMockOrderStatus(second.orderId, "PACKED");
    const refused = await captureError(
      adminCancelOrder({ id: second.orderId, reason: "Khách huỷ" }),
    );
    expect(refused.code).toBe("ORDER_NOT_CANCELLABLE");
  });
});
