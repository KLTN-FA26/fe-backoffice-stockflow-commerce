import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { ORDER_STATUSES } from "@/constants";

import {
  adminCancelOrder,
  buildOrderListQuery,
  closeOrderRemainder,
  getOrder,
  holdOrder,
  listOrders,
  recordDeliveryFailure,
  resolveOrderHold,
  toOrder,
} from "./api";
import {
  apiCancelledOrder,
  apiCreditPosition,
  apiGuestOrder,
  apiPartialOrder,
} from "./__fixtures__/order";
import { approveCreditHold, getCreditPosition, rejectCreditHold } from "./action-api";
import { STATUS_OPTIONS } from "./components/order-list/constants";
import { releaseOrder } from "./delivery-mode-api";
import { getOrderHistory } from "./history-api";
import { orderDtoSchema } from "./schemas";

import type { OrderStatus } from "./types";

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
        isCustom: false,
        designSnapshotId: null,
        reservationIds: ["7a7a7a7a-0000-4000-8000-000000000001"],
        shippedQuantity: null,
        deliveredQuantity: null,
        cancelledQuantity: null,
      },
    ]);
    // BE non_null: field vòng đời vắng → null / mảng rỗng, không parse fail
    expect(order).toMatchObject({ holdReason: null, shipments: [], effectiveTotal: null });
  });

  it("docs 14 BR-02: dòng có designSnapshotId là dòng in (custom); field thanh toán thiếu → null", () => {
    const order = toOrder(
      orderDtoSchema.parse({
        ...beOrder,
        lines: [{ ...beOrder.lines[0], designSnapshotId: "c0ffee00-0000-4000-8000-000000000001" }],
      }),
    );
    expect(order.lines[0]?.isCustom).toBe(true);
    expect(order.paymentTerm).toBeNull();
    expect(order.paymentStatus).toBeNull();
    expect(order.cancellation).toBeNull();
  });

  it("map field thanh toán / release / huỷ (SCRUM-423/427/460)", () => {
    const order = toOrder(
      orderDtoSchema.parse({
        ...beOrder,
        status: "CANCELLED",
        paymentTerm: "DEPOSIT",
        paymentStatus: "PARTIALLY_PAID",
        paidAmount: 100000,
        depositRequired: 105000,
        warehouseId: "8f8f8f8f-0000-4000-8000-000000000001",
        cancellation: { reasonCode: "CUSTOMER_REQUEST", retainedAmount: 0 },
      }),
    );
    expect(order).toMatchObject({
      paymentTerm: "DEPOSIT",
      paymentStatus: "PARTIALLY_PAID",
      paidAmount: 100000,
      depositRequired: 105000,
      depositReceivedAt: null,
      warehouseId: "8f8f8f8f-0000-4000-8000-000000000001",
      cancellation: { reasonCode: "CUSTOMER_REQUEST", reason: null, retainedAmount: 0 },
    });
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

  it("mã đã bị BE bỏ (IN_FULFILMENT / PAID, SCRUM-460 / PR #133) và mã lạ → UNKNOWN, không đoán thành trạng thái khác", () => {
    for (const status of ["PAID", "IN_FULFILMENT", "REVIEWING"]) {
      expect(toOrder(orderDtoSchema.parse({ ...beOrder, status })).status).toBe("UNKNOWN");
    }
  });

  it("thiếu status / null / sai kiểu (field bắt buộc) vẫn fail — bug hợp đồng, không phải trạng thái mới", () => {
    const { status: _omit, ...withoutStatus } = beOrder;
    void _omit;
    expect(() => orderDtoSchema.parse(withoutStatus)).toThrow();
    expect(() => orderDtoSchema.parse({ ...beOrder, status: null })).toThrow();
    expect(() => orderDtoSchema.parse({ ...beOrder, status: 3 })).toThrow();
  });

  it("enum vòng đời / thanh toán sai KIỂU vẫn fail; chỉ CHUỖI lạ mới được dung thứ", () => {
    for (const patch of [
      { holdReason: 1 },
      { deliveryFailureReason: false },
      { statusBeforeHold: 2 },
      { paymentStatus: true },
      { paymentTerm: 1 },
      { shipments: [{ shipmentId: "s-1", status: 7 }] },
    ]) {
      expect(
        orderDtoSchema.safeParse({ ...beOrder, ...patch }).success,
        JSON.stringify(patch),
      ).toBe(false);
    }
  });
});

describe("order API — trạng thái BE mới FE chưa hỗ trợ (forward-compat)", () => {
  it("chi tiết: status lạ (BE thêm sau) → parse được, status UNKNOWN", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { ...beOrder, status: "SOME_FUTURE_STATUS" } });
    const order = await getOrder(beOrder.orderId);
    expect(order.status).toBe("UNKNOWN");
    expect(order.orderNumber).toBe(beOrder.orderNumber);
  });

  it("chi tiết: trạng thái mới của PR #133 (PICKING / PACKED / PARTIALLY_FULFILLED / DELIVERY_FAILED) được hiểu, không phải UNKNOWN", async () => {
    for (const [be, fe] of [
      ["PICKING", "Picking"],
      ["PACKED", "Packed"],
      ["PARTIALLY_FULFILLED", "Partially Fulfilled"],
      ["DELIVERY_FAILED", "Delivery Failed"],
    ]) {
      vi.spyOn(api, "get").mockResolvedValue({ data: { ...beOrder, status: be } });
      expect((await getOrder(beOrder.orderId)).status).toBe(fe);
    }
  });

  it("danh sách: một dòng status lạ không làm hỏng cả trang", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: {
        ...emptyBePage,
        items: [beOrder, { ...beOrder, orderId: "o-2", status: "SOME_FUTURE_STATUS" }],
        totalElements: 2,
        totalPages: 1,
      },
    });
    const page = await listOrders({});
    expect(page.items.map((o) => o.status)).toEqual(["Pending Payment", "UNKNOWN"]);
  });

  it("lịch sử: trạng thái PR #133 map đúng; from / to lạ → UNKNOWN từng vị trí; from vắng vẫn null; người thao tác", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: [
        { to: "PENDING_PAYMENT", occurredAt: "2026-09-07T03:15:00Z" },
        {
          from: "READY_TO_FULFILL",
          to: "PICKING",
          occurredAt: "2026-09-07T04:00:00Z",
          actorId: "u-1",
          actorName: "Điều phối A",
        },
        { from: "PACKED", to: "SOME_FUTURE_STATUS", occurredAt: "2026-09-07T05:00:00Z" },
        { from: "IN_FULFILMENT", to: "SHIPPED", occurredAt: "2026-09-07T06:00:00Z" },
      ],
    });
    // Lịch sử đơn của develop (`history-api.ts`): mục đổi trạng thái có `kind: "status-change"`
    const history = await getOrderHistory(beOrder.orderId);
    expect(
      history.map((entry) =>
        entry.kind === "status-change" ? { from: entry.from, to: entry.to } : entry.kind,
      ),
    ).toEqual([
      { from: null, to: "Pending Payment" },
      { from: "Ready to Fulfill", to: "Picking" },
      { from: "Packed", to: "UNKNOWN" },
      { from: "UNKNOWN", to: "Shipped" },
    ]);
    expect(history[1]).toMatchObject({ actorName: "Điều phối A" });
    expect(history[0]).toMatchObject({ actorName: null, reason: null });
  });

  it("paymentStatus lạ → UNKNOWN; paymentTerm lạ → null (không thành lựa chọn mới)", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { ...beOrder, paymentTerm: "INSTALLMENT", paymentStatus: "REFUNDED" },
    });
    const order = await getOrder(beOrder.orderId);
    expect(order.paymentStatus).toBe("UNKNOWN");
    expect(order.paymentTerm).toBeNull();
  });

  it("paymentTerm vắng key / null → model null; đã biết giữ nguyên", () => {
    expect(toOrder(orderDtoSchema.parse(beOrder)).paymentTerm).toBeNull();
    expect(toOrder(orderDtoSchema.parse({ ...beOrder, paymentTerm: null })).paymentTerm).toBeNull();
    expect(toOrder(orderDtoSchema.parse({ ...beOrder, paymentTerm: "DEPOSIT" })).paymentTerm).toBe(
      "DEPOSIT",
    );
  });
});

describe("order list filter — UNKNOWN chỉ để đọc, không bao giờ gửi BE", () => {
  it("UNKNOWN không có trong lựa chọn lọc trạng thái lẫn tập trạng thái URL", () => {
    expect(STATUS_OPTIONS.map((option) => option.value)).not.toContain("UNKNOWN");
    expect(STATUS_OPTIONS.map((option) => option.value)).toEqual([...ORDER_STATUSES]);
    // useOrderListState: useUrlFilters(FILTERABLE_STATUSES) — ?status=UNKNOWN bị nuqs bỏ
    expect(ORDER_STATUSES).not.toContain("UNKNOWN");
    expect(ORDER_STATUSES).toHaveLength(19);
  });

  it("serializer bỏ UNKNOWN / mã cũ / chuỗi lạ lọt vào lúc chạy, giữ trạng thái đã biết", () => {
    // Kiểu đã chặn UNKNOWN; ép kiểu để mô phỏng giá trị lọt vào lúc chạy (vd config / link cũ)
    const leaked = [
      "UNKNOWN",
      "Shipped",
      "PICKING",
      "In Fulfilment",
      "Paid",
    ] as unknown as OrderStatus[];
    expect(buildOrderListQuery({ status: leaked }).getAll("status")).toEqual(["SHIPPED"]);
  });

  it("mọi trạng thái đã biết serialize đúng 19 mã BE hiện hành (không phát bí danh IN_FULFILMENT / PAID)", () => {
    expect(buildOrderListQuery({ status: [...ORDER_STATUSES] }).getAll("status")).toEqual([
      "DRAFT",
      "PENDING_PAYMENT",
      "CONFIRMED",
      "IN_PRODUCTION",
      "READY_TO_FULFILL",
      "PICKING",
      "PARTIALLY_FULFILLED",
      "PACKED",
      "ON_HOLD",
      "SHIPPED",
      "DELIVERY_FAILED",
      "DELIVERED",
      "RETURN_REQUESTED",
      "RETURNED",
      "REFUNDED",
      "PARTIALLY_REFUNDED",
      "COMPLETED",
      "CANCELLED",
      "CLOSED",
    ]);
  });
});

describe("OrderResponse vòng đời + tiền (BE PR #133)", () => {
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

  it("giao một phần: số lượng theo dòng + lô giao + tiền sau khi đóng phần còn lại giữ nguyên số BE", () => {
    const order = toOrder(orderDtoSchema.parse(apiPartialOrder));
    expect(order.status).toBe("Partially Fulfilled");
    expect(order.lines[0]).toMatchObject({
      quantity: 2,
      shippedQuantity: 1,
      deliveredQuantity: 0,
      cancelledQuantity: 0,
    });
    expect(order.shipments).toEqual([
      {
        shipmentId: "6c5e0a10-1111-4222-8333-444455556666",
        status: "HANDED_OVER",
        amount: 175000,
        billedAmount: null,
        handedOverAt: "2026-09-08T02:00:00Z",
        outcomeAt: null,
        failureReason: null,
        lines: [{ lineId: "9f0e1d2c-aaaa-4bbb-8ccc-dddd00001111", quantity: 1 }],
        codAmount: null,
      },
    ]);
    // Mapper không tự tính tiền: số nào BE gửi thì giữ nguyên, vắng → null
    expect(order).toMatchObject({
      effectiveTotal: 350000,
      amountDue: 100000,
      amountDueBeforeHandover: 0,
      billedAmount: 0,
      amountDueOnDelivery: null,
      packedAt: "2026-09-08T01:00:00Z",
    });
  });

  it("huỷ có khoản thoả thuận: cancellation đủ field BE (fee*), thanh toán + release giữ nguyên", () => {
    const order = toOrder(orderDtoSchema.parse(apiCancelledOrder));
    expect(order).toMatchObject({
      status: "Cancelled",
      paymentTerm: "DEPOSIT",
      paymentStatus: "PARTIALLY_PAID",
      depositReceivedAt: "2026-09-07T04:00:00Z",
      releasedAt: "2026-09-07T05:00:00Z",
      cancellation: {
        reasonCode: "CUSTOMER_REQUEST",
        reason: "CUSTOMER_REQUEST: Khách đổi ý",
        retainedAmount: 50000,
        feeReason: "Đã in",
        feeDetail: "Thoả thuận giữ 50.000 ₫ tiền in",
        feeAmount: 50000,
      },
    });
    expect(order.lines[0]).toMatchObject({ isCustom: true });
  });

  // Giá trị policy lạ → "UNKNOWN" ("Không rõ"), theo BE PR #150 của develop (PR #74 dựa vào để chặn FTL + COD)
  it("đơn cọc thu khi giao (G2-3): balancePolicy + amountDueOnDelivery; giá trị policy lạ → UNKNOWN", () => {
    const order = toOrder(
      orderDtoSchema.parse({
        ...beOrder,
        paymentTerm: "DEPOSIT",
        balancePolicy: "ON_DELIVERY",
        amountDueOnDelivery: 245000,
      }),
    );
    expect(order).toMatchObject({ balancePolicy: "ON_DELIVERY", amountDueOnDelivery: 245000 });
    expect(
      toOrder(orderDtoSchema.parse({ ...beOrder, balancePolicy: "LATER" })).balancePolicy,
    ).toBe("UNKNOWN");
  });
});

describe("GET /orders — danh sách trắng tham số (BE OrderController#list)", () => {
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

  it("listOrders gửi lọc khách (UUID, đã trim) + khoảng ngày", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: emptyBePage });

    await listOrders({
      customerId: " 550e8400-e29b-41d4-a716-446655440000 ",
      placedFrom: "2026-06-01",
      placedTo: "2026-06-30",
    });

    const query = new URLSearchParams(String(get.mock.calls[0]?.[1]?.params));
    expect(query.get("customerId")).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(query.get("placedFrom")).toBe("2026-06-01");
    expect(query.get("placedTo")).toBe("2026-06-30");
  });

  it("BE customerId là UUID: giá trị khác (CUS-0007, UUID cụt, rỗng) không bao giờ được gửi", () => {
    for (const customerId of ["CUS-0007", "abc", "12345", "550e8400-e29b-41d4-a716", "  "]) {
      expect(buildOrderListQuery({ customerId }).has("customerId")).toBe(false);
    }
  });

  it("BE GET /orders không có paymentTerm: tham số lọt vào lúc chạy không được serialize", () => {
    // ListQueryParams có index signature — kiểu không chặn được, serializer phải chặn
    const query = buildOrderListQuery({ paymentTerm: "CREDIT", term: "NET_30" });
    expect(query.has("paymentTerm")).toBe(false);
    expect(query.has("term")).toBe(false);
    expect([...query.keys()].sort()).toEqual(["page", "size"]);
  });
});

describe("getCreditPosition — GET /orders/credit-position/{customerId}", () => {
  it("A. gọi đúng path với UUID khách, map field vắng → null", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: { ...apiCreditPosition, depositPercent: undefined },
    });
    const position = await getCreditPosition(apiCreditPosition.customerId);
    expect(get).toHaveBeenCalledWith(
      `/orders/credit-position/${apiCreditPosition.customerId}`,
      expect.anything(),
    );
    expect(position.depositPercent).toBeNull();
    expect(position.allowedTerms).toEqual(["PREPAID", "DEPOSIT", "CREDIT"]);
  });

  it("A. id khách không phải UUID (CUS-0007) → không bao giờ gọi BE", async () => {
    const get = vi.spyOn(api, "get");
    await expect(getCreditPosition("CUS-0007")).rejects.toThrow();
    expect(get).not.toHaveBeenCalled();
  });
});

describe("Idempotency-Key — chỉ thao tác ghi đơn, header riêng từng request", () => {
  const ID = beOrder.orderId;
  const KEY = "k-0000-test-key";
  const header = { headers: { "Idempotency-Key": KEY } };

  it.each([
    [
      "huỷ admin",
      () => adminCancelOrder({ id: ID, reasonCode: "OTHER", note: "x", idempotencyKey: KEY }),
      `/orders/${ID}/admin-cancellation`,
      { reasonCode: "OTHER", note: "x" },
    ],
    [
      // Release của PR #74 (`delivery-mode-api.ts`) — cùng hợp đồng header
      "release",
      () => releaseOrder({ id: ID, warehouseId: "W1", idempotencyKey: KEY }),
      `/orders/${ID}/release`,
      { warehouseId: "W1" },
    ],
    [
      "duyệt công nợ",
      () => approveCreditHold({ id: ID, note: "ok", idempotencyKey: KEY }),
      `/orders/${ID}/credit-approval`,
      { note: "ok" },
    ],
    [
      "từ chối công nợ",
      () => rejectCreditHold({ id: ID, action: "CANCEL", note: "no", idempotencyKey: KEY }),
      `/orders/${ID}/credit-rejection`,
      { action: "CANCEL", note: "no" },
    ],
  ])(
    "A/B/E. %s → đúng key trong header, body + path không đổi, key KHÔNG vào body",
    async (_, call, path, body) => {
      const post = vi.spyOn(api, "post").mockResolvedValue({ data: beOrder });
      await call();
      expect(post).toHaveBeenCalledWith(path, body, header);
    },
  );

  it("không có key → không gửi header (gọi trực tiếp, vd mock / script)", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: beOrder });
    await releaseOrder({ id: ID, warehouseId: "W1" });
    expect(post).toHaveBeenCalledWith(`/orders/${ID}/release`, { warehouseId: "W1" }, undefined);
  });

  it("C. đọc dữ liệu (GET) không bao giờ mang Idempotency-Key", async () => {
    const get = vi.spyOn(api, "get").mockImplementation(async (url: string) => ({
      data: url.endsWith("/history")
        ? []
        : url === "/orders"
          ? emptyBePage
          : url.includes("credit-position")
            ? apiCreditPosition
            : beOrder,
    }));
    await listOrders({});
    await getOrder(ID);
    await getOrderHistory(ID);
    await getCreditPosition(apiCreditPosition.customerId);
    for (const [, config] of get.mock.calls) {
      expect(JSON.stringify(config ?? {})).not.toContain("Idempotency-Key");
    }
  });
});

describe("POST /orders/{id}/admin-cancellation — AdminCancelOrderRequest → OrderResponse", () => {
  it("body chỉ gồm field BE (reasonCode, note, retainedPercent / agreedFee) — id & key không vào body", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiCancelledOrder });
    const agreedFee = { amount: 50000, reason: "Đã in", detail: "Giữ tiền in" };
    const order = await adminCancelOrder({
      id: beOrder.orderId,
      idempotencyKey: "k-1",
      reasonCode: "CUSTOMER_REQUEST",
      note: "Khách đổi ý",
      agreedFee,
    });
    expect(post).toHaveBeenCalledWith(
      `/orders/${beOrder.orderId}/admin-cancellation`,
      { reasonCode: "CUSTOMER_REQUEST", note: "Khách đổi ý", agreedFee },
      { headers: { "Idempotency-Key": "k-1" } },
    );
    // Response OrderResponse được parse + map như GET
    expect(order).toMatchObject({ status: "Cancelled", cancellation: { feeAmount: 50000 } });
  });

  it("response sai hợp đồng (thiếu status) → lỗi, không trả đơn bịa", async () => {
    const { status: _omit, ...broken } = apiCancelledOrder;
    void _omit;
    vi.spyOn(api, "post").mockResolvedValue({ data: broken });
    await expect(
      adminCancelOrder({ id: beOrder.orderId, reasonCode: "CUSTOMER_REQUEST" }),
    ).rejects.toThrow();
  });
});

describe("thao tác trạng thái đơn (BE PR #133) — mỗi endpoint trả OrderResponse", () => {
  const ID = "0b6f7c1e-4c5d-4f1a-9a77-2f3e6f1d2a10";

  it("giữ đơn: POST /hold {reasonCode, note}; bỏ note khi trống; trả đơn đã map", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: { ...beOrder, status: "ON_HOLD", holdReason: "ADDRESS" } });
    const held = await holdOrder({ id: ID, reasonCode: "ADDRESS", note: "Sai phường" });
    await holdOrder({ id: ID, reasonCode: "FRAUD", note: "" });
    expect(post).toHaveBeenNthCalledWith(
      1,
      `/orders/${ID}/hold`,
      { reasonCode: "ADDRESS", note: "Sai phường" },
      undefined,
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      `/orders/${ID}/hold`,
      { reasonCode: "FRAUD" },
      undefined,
    );
    expect(held).toMatchObject({ status: "On Hold", holdReason: "ADDRESS" });
  });

  it("gỡ giữ: POST /hold/resolution {note}", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: beOrder });
    const resolved = await resolveOrderHold({ id: ID, note: "Khách xác nhận địa chỉ mới" });
    expect(post).toHaveBeenCalledWith(
      `/orders/${ID}/hold/resolution`,
      { note: "Khách xác nhận địa chỉ mới" },
      undefined,
    );
    expect(resolved.status).toBe("Pending Payment");
  });

  it("ghi giao thất bại và đóng phần còn lại gọi đúng endpoint, đúng body", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiPartialOrder });
    await recordDeliveryFailure({ id: ID, reasonCode: "CUSTOMER_ABSENT", note: "" });
    const closed = await closeOrderRemainder({
      id: ID,
      reasonCode: "OTHER",
      note: "Hết hàng cả kho",
    });
    expect(post).toHaveBeenNthCalledWith(
      1,
      `/orders/${ID}/delivery-failure`,
      { reasonCode: "CUSTOMER_ABSENT" },
      undefined,
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      `/orders/${ID}/remainder-closure`,
      { reasonCode: "OTHER", note: "Hết hàng cả kho" },
      undefined,
    );
    expect(closed.shipments).toHaveLength(1);
  });

  it.each([
    [
      "giữ đơn",
      () => holdOrder({ id: ID, reasonCode: "FRAUD", note: "", idempotencyKey: "k-h" }),
      "k-h",
    ],
    ["gỡ giữ", () => resolveOrderHold({ id: ID, note: "ok", idempotencyKey: "k-r" }), "k-r"],
    [
      "giao thất bại",
      () => recordDeliveryFailure({ id: ID, reasonCode: "LOST", note: "", idempotencyKey: "k-d" }),
      "k-d",
    ],
    [
      "đóng phần còn lại",
      () =>
        closeOrderRemainder({
          id: ID,
          reasonCode: "OUT_OF_STOCK",
          note: "",
          idempotencyKey: "k-c",
        }),
      "k-c",
    ],
  ])("%s → Idempotency-Key ở header, không vào body", async (_, call, key) => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: beOrder });
    await call();
    const [, body, config] = post.mock.calls[0] ?? [];
    expect(config).toEqual({ headers: { "Idempotency-Key": key } });
    expect(JSON.stringify(body)).not.toContain(key);
    expect(body).not.toHaveProperty("id");
  });
});
