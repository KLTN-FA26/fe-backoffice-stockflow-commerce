/** Fixture đúng hình BE `OrderResponse` (sau khi interceptor bóc envelope). */

import type { OrderDto, OrderPageDto } from "../types";

export const apiOrder: OrderDto = {
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
      reservationIds: [],
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

export function apiOrderPage(items: OrderDto[], page = 0, size = 15): OrderPageDto {
  const totalPages = Math.ceil(items.length / size);
  return {
    items,
    page,
    size,
    totalElements: items.length,
    totalPages,
    hasNext: page + 1 < totalPages,
    hasPrevious: page > 0,
  };
}

/**
 * Đơn guest checkout — đúng hình JSON BE trả: Jackson `non_null` BỎ HẲN các key null, nên không
 * có `customerId`, `billingAddress`, `createdBy`… (không phải `customerId: null`).
 */
export const apiGuestOrder = {
  orderId: "7e1d2c3b-9a8f-4e6d-8c5b-1a2b3c4d5e6f",
  orderNumber: "SO-20261002-000002",
  status: "PAID",
  totalAmount: 30000000,
  currency: "VND",
  lines: [
    {
      lineId: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
      sku: "SOFA-3S-GREY",
      quantity: 2,
      unitPrice: 15000000,
      lineTotal: 30000000,
      reservationIds: [],
    },
  ],
  placedAt: "2026-10-02T10:38:00Z",
  contactName: "Nguyễn Văn A",
  contactEmail: "guest@example.com",
  contactPhone: "+84900000001",
  shippingAddress: {
    recipientName: "Nguyễn Văn A",
    phone: "+84900000001",
    line1: "123 Nguyễn Huệ",
    wardName: "Phường Bến Nghé",
    provinceName: "TP. Hồ Chí Minh",
    countryCode: "VN",
  },
};
