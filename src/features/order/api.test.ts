import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { getOrder, listOrders, toOrder } from "./api";
import { apiGuestOrder } from "./__fixtures__/order";
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
      },
    ]);
  });

  it("đơn guest (BE bỏ hẳn key customerId vì non_null) vẫn parse được", () => {
    expect("customerId" in apiGuestOrder).toBe(false);
    const order = toOrder(orderDtoSchema.parse(apiGuestOrder));

    expect(order.customerId).toBeNull();
    expect(order.status).toBe("Paid");
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
    ["PAID", "Paid"],
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

  it("status lạ ngoài OrderStatus.java → parse fail (bug contract)", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { ...beOrder, status: "PICKING" } });
    await expect(getOrder(beOrder.orderId)).rejects.toThrow();
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
