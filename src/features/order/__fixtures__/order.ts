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
      // BE luôn gửi ba số này (0 khi đơn chưa có lô) — OrderServiceImpl#lifecycleOf
      shippedQuantity: 0,
      deliveredQuantity: 0,
      cancelledQuantity: 0,
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
  // BE luôn gửi các số tiền (billedAmount bắt đầu từ 0; amountDue tính từ tổng đơn)
  paymentTerm: "PREPAID",
  billedAmount: 0,
  effectiveTotal: 350000,
  amountDue: 350000,
  amountDueBeforeHandover: 350000,
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
  status: "CONFIRMED",
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

/** Đơn BE ở trạng thái `status` kèm hai cờ giao một phần của BE PR #150. */
export function apiOrderPartialShipment(
  status: OrderDto["status"],
  flags: { allowPartialShipment: boolean; printLinesReady?: boolean },
): OrderDto {
  return { ...apiOrder, status, printLinesReady: true, ...flags };
}

/** Đơn BE PICKING — dựng nhanh các biến thể cho test thao tác trạng thái. */
export function apiOrderWith(patch: Record<string, unknown>) {
  return { ...apiOrder, ...patch } as OrderDto;
}

const PARTIAL_LINE_ID = "9f0e1d2c-aaaa-4bbb-8ccc-dddd00001111";

/** Đơn giao một phần: một lô đã bàn giao 1/2 đơn vị, dòng hàng có số lượng giao (BE PR #133). */
export const apiPartialOrder: OrderDto = {
  ...apiOrder,
  status: "PARTIALLY_FULFILLED",
  lines: [
    {
      lineId: PARTIAL_LINE_ID,
      sku: "TSHIRT-WHT-M",
      quantity: 2,
      unitPrice: 175000,
      lineTotal: 350000,
      reservationIds: [],
      shippedQuantity: 1,
      deliveredQuantity: 0,
      cancelledQuantity: 0,
    },
  ],
  packedAt: "2026-09-08T01:00:00Z",
  effectiveTotal: 350000,
  amountDue: 100000,
  amountDueBeforeHandover: 0,
  shipments: [
    {
      shipmentId: "6c5e0a10-1111-4222-8333-444455556666",
      status: "HANDED_OVER",
      amount: 175000,
      handedOverAt: "2026-09-08T02:00:00Z",
      lines: [{ lineId: PARTIAL_LINE_ID, quantity: 1 }],
    },
  ],
};

/** Đơn BE ở trạng thái `status` kèm hình thức giao (BE PR #157) và cờ khoá. */
export function apiOrderDelivery(
  status: OrderDto["status"],
  delivery: { deliveryMode: "PARCEL" | "FULL_TRUCKLOAD"; deliveryModeLocked: boolean },
  patch: Record<string, unknown> = {},
): OrderDto {
  return apiOrderWith({ status, ...delivery, ...patch });
}
