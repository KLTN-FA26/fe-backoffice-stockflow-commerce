import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import {
  closeOrderRemainder,
  getOrder,
  holdOrder,
  listOrders,
  recordDeliveryFailure,
  resolveOrderHold,
  toOrder,
} from "./api";
import { apiGuestOrder } from "./__fixtures__/order";
import { getOrderHistory, toOrderHistoryEntry } from "./history-api";
import { decidePartialShipment } from "./partial-shipment-api";
import { orderDtoSchema } from "./schemas";

/** Hình dạng `OrderResponse` BE (develop) sau khi interceptor bóc envelope. */
const beOrder = {
  orderId: "0b6f7c1e-4c5d-4f1a-9a77-2f3e6f1d2a10",
  orderNumber: "SO-20260907-000431",
  customerId: "5d1e2f3a-1111-4222-8333-444455556666",
  status: "PENDING_PAYMENT",
  totalAmount: 350000,
  currency: "VND",
  lines: [
    {
      lineId: "9f0e1d2c-aaaa-4bbb-8ccc-dddd00001111",
      sku: "TSHIRT-WHT-M",
      quantity: 2,
      unitPrice: 175000,
      lineTotal: 350000,
      reservationIds: ["7a7a7a7a-0000-4000-8000-000000000001"],
      designSnapshotId: null,
      designChecksum: null,
    },
  ],
  placedAt: "2026-09-07T03:15:00Z",
  createdBy: "customer",
  lastModifiedAt: null,
  lastModifiedBy: null,
  contactName: "Nguyễn Văn A",
  contactEmail: "a@example.com",
  contactPhone: "0900000000",
  shippingAddress: {
    recipientName: "Trần Thị B",
    phone: "0911111111",
    line1: "12 Lê Lợi",
    line2: null,
    wardCode: "26734",
    wardName: "Phường Bến Nghé",
    provinceCode: "79",
    provinceName: "TP. Hồ Chí Minh",
    countryCode: "VN",
    postalCode: null,
  },
  billingAddress: null,
};

const emptyBePage = {
  items: [],
  page: 0,
  size: 15,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
};

afterEach(() => vi.restoreAllMocks());

describe("order API contract (BE OrderResponse)", () => {
  it("map DTO BE → model FE: status, người nhận, địa chỉ, dòng hàng", () => {
    const order = toOrder(orderDtoSchema.parse(beOrder));

    expect(order).toMatchObject({
      orderNumber: "SO-20260907-000431",
      status: "Pending Payment",
      totalAmount: 350000,
      currency: "VND",
      recipientName: "Trần Thị B",
      recipientPhone: "0911111111",
      contactEmail: "a@example.com",
      shippingAddressText: "12 Lê Lợi, Phường Bến Nghé, TP. Hồ Chí Minh",
    });
    expect(order.lines).toEqual([
      {
        lineId: beOrder.lines[0]?.lineId,
        sku: "TSHIRT-WHT-M",
        quantity: 2,
        unitPrice: 175000,
        lineTotal: 350000,
        shippedQuantity: null,
        deliveredQuantity: null,
        cancelledQuantity: null,
      },
    ]);
    // BE non_null: field vòng đời vắng → null / mảng rỗng, không parse fail
    expect(order).toMatchObject({ holdReason: null, shipments: [], effectiveTotal: null });
  });

  it("đơn guest (BE bỏ hẳn key customerId vì non_null) vẫn parse được", () => {
    expect("customerId" in apiGuestOrder).toBe(false);
    const order = toOrder(orderDtoSchema.parse(apiGuestOrder));

    expect(order.customerId).toBeNull();
    expect(order.status).toBe("Confirmed");
    expect(order.recipientName).toBe("Nguyễn Văn A");
    expect(order.shippingAddressText).toBe("123 Nguyễn Huệ, Phường Bến Nghé, TP. Hồ Chí Minh");
  });

  it("địa chỉ thiếu recipientName/phone/line1 (key vắng) → vẫn parse, fallback contact*", () => {
    const order = toOrder(
      orderDtoSchema.parse({
        ...apiGuestOrder,
        shippingAddress: { wardName: "Phường Bến Nghé", provinceName: "TP. Hồ Chí Minh" },
      }),
    );
    expect(order.recipientName).toBe("Nguyễn Văn A");
    expect(order.recipientPhone).toBe("+84900000001");
  });

  it("không có shippingAddress → fallback contact*, địa chỉ null", () => {
    const order = toOrder(orderDtoSchema.parse({ ...beOrder, shippingAddress: null }));
    expect(order.recipientName).toBe("Nguyễn Văn A");
    expect(order.shippingAddressText).toBeNull();
  });

  it("getOrder gọi path không có v1 và parse response", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: beOrder });

    const order = await getOrder(beOrder.orderId);

    expect(get).toHaveBeenCalledWith(`/orders/${beOrder.orderId}`, { signal: undefined });
    expect(order.status).toBe("Pending Payment");
  });

  it.each([
    ["DRAFT", "Draft"],
    ["PENDING_PAYMENT", "Pending Payment"],
    ["CONFIRMED", "Confirmed"],
    ["IN_PRODUCTION", "In Production"],
    ["READY_TO_FULFILL", "Ready to Fulfill"],
    ["PICKING", "Picking"],
    ["PARTIALLY_FULFILLED", "Partially Fulfilled"],
    ["PACKED", "Packed"],
    ["ON_HOLD", "On Hold"],
    ["SHIPPED", "Shipped"],
    ["DELIVERY_FAILED", "Delivery Failed"],
    ["DELIVERED", "Delivered"],
    ["RETURN_REQUESTED", "Return Requested"],
    ["RETURNED", "Returned"],
    ["REFUNDED", "Refunded"],
    ["PARTIALLY_REFUNDED", "Partially Refunded"],
    ["COMPLETED", "Completed"],
    ["CANCELLED", "Cancelled"],
    ["CLOSED", "Closed"],
  ])("status BE %s ↔ FE %s (1-1)", (be, fe) => {
    const order = toOrder(orderDtoSchema.parse({ ...beOrder, status: be }));
    expect(order.status).toBe(fe);
  });

  it("mã tiền tệ khác VND/USD (vd EUR) vẫn parse được — không hỏng cả trang", () => {
    const order = toOrder(orderDtoSchema.parse({ ...beOrder, currency: "EUR" }));
    expect(order.currency).toBe("EUR");
  });

  it("mã tiền tệ sai định dạng → parse fail", () => {
    expect(() => orderDtoSchema.parse({ ...beOrder, currency: "vnd" })).toThrow();
  });

  it("status lạ (BE thêm sau) và mã cũ IN_FULFILMENT / PAID → UNKNOWN, không hỏng cả trang", async () => {
    for (const status of ["REVIEWING", "IN_FULFILMENT", "PAID"]) {
      vi.spyOn(api, "get").mockResolvedValue({ data: { ...beOrder, status } });
      expect((await getOrder(beOrder.orderId)).status).toBe("UNKNOWN");
    }
  });

  it("OrderResponse đầy đủ vòng đời (BE PR #133): giữ đơn, mốc thời gian, tiền, lô giao, số lượng dòng", () => {
    const order = toOrder(
      orderDtoSchema.parse({
        ...beOrder,
        status: "ON_HOLD",
        holdReason: "ADDRESS",
        holdReasonPublic: "UNDER_REVIEW",
        statusBeforeHold: "PICKING",
        holdNote: "Sai phường",
        packedAt: "2026-09-08T01:00:00Z",
        shippedAt: "2026-09-08T02:00:00Z",
        deliveredAt: "2026-09-09T02:00:00Z",
        deliveryFailureReason: "CUSTOMER_ABSENT",
        completedAt: "2026-09-16T02:00:00Z",
        closedAt: "2026-10-16T02:00:00Z",
        billedAmount: 100000,
        effectiveTotal: 250000,
        amountDue: 50000,
        amountDueBeforeHandover: 0,
        lines: [
          { ...beOrder.lines[0], shippedQuantity: 1, deliveredQuantity: 0, cancelledQuantity: 1 },
        ],
        shipments: [
          {
            shipmentId: "s-1",
            status: "HANDED_OVER",
            amount: 175000,
            handedOverAt: "2026-09-08T02:00:00Z",
            lines: [{ lineId: beOrder.lines[0]?.lineId, quantity: 1 }],
          },
          { shipmentId: "s-2", status: "SOMETHING_NEW" },
        ],
      }),
    );

    expect(order).toMatchObject({
      status: "On Hold",
      holdReason: "ADDRESS",
      statusBeforeHold: "Picking",
      holdNote: "Sai phường",
      packedAt: "2026-09-08T01:00:00Z",
      deliveryFailureReason: "CUSTOMER_ABSENT",
      closedAt: "2026-10-16T02:00:00Z",
      billedAmount: 100000,
      effectiveTotal: 250000,
      amountDue: 50000,
      amountDueBeforeHandover: 0,
    });
    expect(order.lines[0]).toMatchObject({
      shippedQuantity: 1,
      deliveredQuantity: 0,
      cancelledQuantity: 1,
    });
    expect(order.shipments).toHaveLength(2);
    expect(order.shipments[0]).toMatchObject({
      status: "HANDED_OVER",
      billedAmount: null,
      amount: 175000,
    });
    // Trạng thái lô lạ → UNKNOWN, lô không có `lines` → []
    expect(order.shipments[1]).toMatchObject({ status: "UNKNOWN", lines: [] });
  });

  it("lý do giữ lạ → UNKNOWN (không cho gỡ giữ), không parse fail", () => {
    const order = toOrder(
      orderDtoSchema.parse({ ...beOrder, status: "ON_HOLD", holdReason: "NEW_REASON" }),
    );
    expect(order.holdReason).toBe("UNKNOWN");
  });

  it("listOrders mặc định chỉ gửi page/size — không có search rỗng", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: emptyBePage });

    await listOrders({ page: 0, size: 15, search: "", status: [] });

    const query = get.mock.calls[0]?.[1]?.params;
    expect(query).toBeInstanceOf(URLSearchParams);
    expect(String(query)).toBe("page=0&size=15");
  });

  it("listOrders gửi status giá trị BE dạng key lặp, search đã trim, sort", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: emptyBePage });

    await listOrders({
      page: 1,
      size: 15,
      search: "  SO-2026 ",
      status: ["Pending Payment", "Shipped"],
      sort: "placedAt,desc",
    });

    const query = new URLSearchParams(String(get.mock.calls[0]?.[1]?.params));
    expect(query.get("search")).toBe("SO-2026");
    expect(query.getAll("status")).toEqual(["PENDING_PAYMENT", "SHIPPED"]);
    expect(query.get("sort")).toBe("placedAt,desc");
  });
});

describe("thao tác trạng thái đơn (BE PR #133)", () => {
  const ID = "0b6f7c1e-4c5d-4f1a-9a77-2f3e6f1d2a10";

  it("giữ đơn: POST /hold {reasonCode, note}; bỏ note khi trống", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });
    await holdOrder({ id: ID, reasonCode: "ADDRESS", note: "Sai phường" });
    await holdOrder({ id: ID, reasonCode: "FRAUD", note: "" });
    expect(post).toHaveBeenNthCalledWith(1, `/orders/${ID}/hold`, {
      reasonCode: "ADDRESS",
      note: "Sai phường",
    });
    expect(post).toHaveBeenNthCalledWith(2, `/orders/${ID}/hold`, { reasonCode: "FRAUD" });
  });

  it("gỡ giữ: POST /hold/resolution {note}", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });
    await resolveOrderHold({ id: ID, note: "Khách xác nhận địa chỉ mới" });
    expect(post).toHaveBeenCalledWith(`/orders/${ID}/hold/resolution`, {
      note: "Khách xác nhận địa chỉ mới",
    });
  });

  it("ghi giao thất bại và đóng phần còn lại gọi đúng endpoint", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });
    await recordDeliveryFailure({ id: ID, reasonCode: "CUSTOMER_ABSENT", note: "" });
    await closeOrderRemainder({ id: ID, reasonCode: "OTHER", note: "Hết hàng cả kho" });
    expect(post).toHaveBeenNthCalledWith(1, `/orders/${ID}/delivery-failure`, {
      reasonCode: "CUSTOMER_ABSENT",
    });
    expect(post).toHaveBeenNthCalledWith(2, `/orders/${ID}/remainder-closure`, {
      reasonCode: "OTHER",
      note: "Hết hàng cả kho",
    });
  });
});

describe("order API — BE PR #150 (giao một phần, công nợ phần còn lại, lịch sử)", () => {
  const ID = beOrder.orderId;

  it("toOrder: allowPartialShipment / printLinesReady / balancePolicy / creditTermDays", () => {
    const order = toOrder(
      orderDtoSchema.parse({
        ...beOrder,
        paymentTerm: "DEPOSIT",
        balancePolicy: "ON_CREDIT",
        creditTermDays: 30,
        allowPartialShipment: true,
        printLinesReady: false,
      }),
    );
    expect(order).toMatchObject({
      balancePolicy: "ON_CREDIT",
      creditTermDays: 30,
      allowPartialShipment: true,
      printLinesReady: false,
    });
  });

  it("toOrder: BE không trả các field → null (không đoán là false)", () => {
    const order = toOrder(orderDtoSchema.parse(beOrder));
    expect(order).toMatchObject({
      balancePolicy: null,
      creditTermDays: null,
      allowPartialShipment: null,
      printLinesReady: null,
    });
  });

  it("decidePartialShipment: PUT /orders/{id}/partial-shipment {allowed, note?}", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: beOrder });
    await decidePartialShipment({ id: ID, allowed: true, note: "Khách đồng ý" });
    await decidePartialShipment({ id: ID, allowed: false, note: "" });
    expect(put).toHaveBeenNthCalledWith(1, `/orders/${ID}/partial-shipment`, {
      allowed: true,
      note: "Khách đồng ý",
    });
    // note rỗng bị bỏ khỏi body (BE @Size, null hợp lệ)
    expect(put).toHaveBeenNthCalledWith(2, `/orders/${ID}/partial-shipment`, { allowed: false });
  });

  it("closeOrderRemainder: agreedFee chỉ gửi khi có", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });
    const agreedFee = { amount: 4_000_000, reason: "Đã in", detail: "Khách đồng ý" };
    await closeOrderRemainder({ id: ID, reasonCode: "CUSTOMER_REQUEST", note: "", agreedFee });
    await closeOrderRemainder({ id: ID, reasonCode: "CUSTOMER_REQUEST", note: "" });
    expect(post).toHaveBeenNthCalledWith(1, `/orders/${ID}/remainder-closure`, {
      reasonCode: "CUSTOMER_REQUEST",
      agreedFee,
    });
    expect(post).toHaveBeenNthCalledWith(2, `/orders/${ID}/remainder-closure`, {
      reasonCode: "CUSTOMER_REQUEST",
    });
  });

  it("getOrderHistory: GET /orders/{id}/history, phân loại mục theo type", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: [
        {
          type: "STATUS_CHANGE",
          from: null,
          to: "PENDING_PAYMENT",
          occurredAt: "2026-10-01T00:00:00Z",
        },
        {
          type: "STATUS_CHANGE",
          from: "PICKING",
          to: "PACKED",
          reason: "ok",
          occurredAt: "2026-10-02T00:00:00Z",
          actorName: "Kho A",
        },
        {
          type: "PARTIAL_SHIPMENT_DECISION",
          from: null,
          to: null,
          reason: "Khách đồng ý",
          occurredAt: "2026-10-03T00:00:00Z",
          actorName: "Sale A",
          partialShipmentAllowed: false,
        },
      ],
    });

    const entries = await getOrderHistory(ID);

    expect(get).toHaveBeenCalledWith(`/orders/${ID}/history`, { signal: undefined });
    expect(entries).toEqual([
      {
        kind: "status-change",
        from: null,
        to: "Pending Payment",
        reason: null,
        actorName: null,
        occurredAt: "2026-10-01T00:00:00Z",
      },
      {
        kind: "status-change",
        from: "Picking",
        to: "Packed",
        reason: "ok",
        actorName: "Kho A",
        occurredAt: "2026-10-02T00:00:00Z",
      },
      {
        kind: "partial-shipment",
        allowed: false,
        reason: "Khách đồng ý",
        actorName: "Sale A",
        occurredAt: "2026-10-03T00:00:00Z",
      },
    ]);
  });

  it("toOrderHistoryEntry: type lạ, hoặc thiếu dữ liệu cần → 'unknown', không hỏng lịch sử", () => {
    const base = { occurredAt: "2026-10-01T00:00:00Z" };
    expect(toOrderHistoryEntry({ ...base, type: "UNKNOWN" }).kind).toBe("unknown");
    // quyết định mà thiếu cờ allowed → không đoán
    expect(toOrderHistoryEntry({ ...base, type: "PARTIAL_SHIPMENT_DECISION" }).kind).toBe(
      "unknown",
    );
    // đổi trạng thái mà thiếu `to`
    expect(toOrderHistoryEntry({ ...base, type: "STATUS_CHANGE" }).kind).toBe("unknown");
  });
});
