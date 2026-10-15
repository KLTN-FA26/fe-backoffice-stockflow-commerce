import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { ORDER_STATUSES } from "@/constants";

import { buildOrderListQuery, getOrder, getOrderHistory, listOrders, toOrder } from "./api";
import { apiGuestOrder } from "./__fixtures__/order";
import { STATUS_OPTIONS } from "./components/order-list/constants";
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
      },
    ]);
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
    ["IN_FULFILMENT", "In Fulfilment"],
    ["ON_HOLD", "On Hold"],
    ["SHIPPED", "Shipped"],
    ["DELIVERED", "Delivered"],
    ["COMPLETED", "Completed"],
    ["CANCELLED", "Cancelled"],
    ["RETURNED", "Returned"],
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

  it("PAID đã bị BE bỏ (SCRUM-460) → UNKNOWN, không đoán thành Confirmed", () => {
    expect(toOrder(orderDtoSchema.parse({ ...beOrder, status: "PAID" })).status).toBe("UNKNOWN");
  });

  it("thiếu status (field bắt buộc) vẫn fail — bug hợp đồng, không phải trạng thái mới", () => {
    const { status: _omit, ...withoutStatus } = beOrder;
    void _omit;
    expect(() => orderDtoSchema.parse(withoutStatus)).toThrow();
    expect(() => orderDtoSchema.parse({ ...beOrder, status: null })).toThrow();
  });
});

describe("order API — trạng thái BE mới FE chưa hỗ trợ (forward-compat)", () => {
  it("chi tiết: status lạ (PICKING) → parse được, status UNKNOWN", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { ...beOrder, status: "PICKING" } });
    const order = await getOrder(beOrder.orderId);
    expect(order.status).toBe("UNKNOWN");
    expect(order.orderNumber).toBe(beOrder.orderNumber);
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

  it("lịch sử: from / to lạ → UNKNOWN từng vị trí; from vắng vẫn null", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: [
        { to: "PENDING_PAYMENT", occurredAt: "2026-09-07T03:15:00Z" },
        { from: "PENDING_PAYMENT", to: "PICKING", occurredAt: "2026-09-07T04:00:00Z" },
        { from: "PACKED", to: "SHIPPED", occurredAt: "2026-09-07T05:00:00Z" },
      ],
    });
    const history = await getOrderHistory(beOrder.orderId);
    expect(history.map(({ from, to }) => ({ from, to }))).toEqual([
      { from: null, to: "Pending Payment" },
      { from: "Pending Payment", to: "UNKNOWN" },
      { from: "UNKNOWN", to: "Shipped" },
    ]);
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
    // useOrderListState: useUrlFilters(ORDER_STATUSES) — ?status=UNKNOWN bị nuqs bỏ
    expect(ORDER_STATUSES).not.toContain("UNKNOWN");
  });

  it("serializer bỏ UNKNOWN / chuỗi lạ lọt vào lúc chạy, giữ mã đã biết", () => {
    // Kiểu đã chặn UNKNOWN; ép kiểu để mô phỏng giá trị lọt vào lúc chạy (vd config cũ)
    const leaked = ["UNKNOWN", "Shipped", "PICKING"] as unknown as OrderStatus[];
    expect(buildOrderListQuery({ status: leaked }).getAll("status")).toEqual(["SHIPPED"]);
  });

  it("mọi trạng thái đã biết vẫn serialize đúng mã BE như trước", () => {
    expect(buildOrderListQuery({ status: [...ORDER_STATUSES] }).getAll("status")).toEqual([
      "DRAFT",
      "PENDING_PAYMENT",
      "CONFIRMED",
      "IN_PRODUCTION",
      "READY_TO_FULFILL",
      "IN_FULFILMENT",
      "ON_HOLD",
      "SHIPPED",
      "DELIVERED",
      "COMPLETED",
      "CANCELLED",
      "RETURNED",
    ]);
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

  it("listOrders gửi lọc khách, khoảng ngày, phương thức thanh toán (contract pending)", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: emptyBePage });

    await listOrders({
      customerId: " CUS-0007 ",
      placedFrom: "2026-06-01",
      placedTo: "2026-06-30",
      paymentTerm: "CREDIT",
    });

    const query = new URLSearchParams(String(get.mock.calls[0]?.[1]?.params));
    expect(query.get("customerId")).toBe("CUS-0007");
    expect(query.get("placedFrom")).toBe("2026-06-01");
    expect(query.get("placedTo")).toBe("2026-06-30");
    expect(query.get("paymentTerm")).toBe("CREDIT");
  });
});
