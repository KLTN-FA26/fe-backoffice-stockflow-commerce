/**
 * Order — model FE (kiểu UI đọc, sau khi map status BE → FE). DTO ở `schemas.ts`.
 */

import { z } from "zod";

import {
  ORDER_DELIVERY_FAILURE_REASONS,
  ORDER_HOLD_REASONS,
  ORDER_SHIPMENT_READ_STATUSES,
} from "@/constants/labels-order";
import { ORDER_PAYMENT_READ_STATUSES, ORDER_PAYMENT_TERMS } from "@/constants/orders";
import { ORDER_READ_STATUSES, ORDER_STATUS_UNKNOWN } from "@/constants/statuses";

import { orderDeliveryModeDtoSchema } from "./delivery-mode-schemas";
import { currencyCode, orderBalancePolicyDtoSchema, orderShipmentLineDtoSchema } from "./schemas";

const orderDeliveryFailureReasonSchema = z.enum([
  ...ORDER_DELIVERY_FAILURE_REASONS,
  ORDER_STATUS_UNKNOWN,
]);

/**
 * Dòng đơn. `isCustom`: dòng in theo thiết kế ⇔ `designSnapshotId != null`
 * (BE `OrderLine#isMadeToOrder`, docs 14 BR-02) — BE không có cờ riêng.
 */
export const orderLineSchema = z.object({
  lineId: z.string(),
  sku: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  lineTotal: z.number(),
  isCustom: z.boolean(),
  designSnapshotId: z.string().nullable(),
  /** Phiếu giữ hàng của dòng — BE chỉ trả mã, chưa có API xem chi tiết reservation. */
  reservationIds: z.array(z.string()),
  /** null khi BE không trả (dòng danh sách / đơn chưa có lô giao). */
  shippedQuantity: z.number().int().nullable(),
  deliveredQuantity: z.number().int().nullable(),
  cancelledQuantity: z.number().int().nullable(),
});

export const orderShipmentSchema = z.object({
  shipmentId: z.string(),
  status: z.enum(ORDER_SHIPMENT_READ_STATUSES),
  amount: z.number().nullable(),
  billedAmount: z.number().nullable(),
  handedOverAt: z.string().nullable(),
  outcomeAt: z.string().nullable(),
  failureReason: orderDeliveryFailureReasonSchema.nullable(),
  /** Rỗng khi BE không gửi `lines`. */
  lines: z.array(orderShipmentLineDtoSchema),
  codAmount: z.number().nullable(),
});

export const orderCancellationSchema = z.object({
  reasonCode: z.string().nullable(),
  reason: z.string().nullable(),
  retainedAmount: z.number().nullable(),
  feeReason: z.string().nullable(),
  feeDetail: z.string().nullable(),
  feeAmount: z.number().nullable(),
});

/**
 * Kiểu UI đọc. Người nhận lấy từ `shippingAddress`, fallback `contact*`.
 * BE không trả subtotal/phí ship/thuế/giảm giá → UI không hiển thị các field đó (không bịa số).
 * Field BE vắng → null (mảng → []); mapper không tự tính số tiền nào.
 */
export const orderSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string().nullable(),
  status: z.enum(ORDER_READ_STATUSES),
  totalAmount: z.number(),
  currency: currencyCode,
  placedAt: z.string(),
  recipientName: z.string(),
  recipientPhone: z.string(),
  contactEmail: z.string().nullable(),
  /** Địa chỉ giao đã ghép sẵn (line1, line2, phường/xã, tỉnh); null khi BE không có. */
  shippingAddressText: z.string().nullable(),
  lines: z.array(orderLineSchema),
  // Thanh toán / release / huỷ (SCRUM-423/427/460)
  paymentTerm: z.enum(ORDER_PAYMENT_TERMS).nullable(),
  paymentStatus: z.enum(ORDER_PAYMENT_READ_STATUSES).nullable(),
  paidAmount: z.number().nullable(),
  paidInFullAt: z.string().nullable(),
  /** Số ngày trả sau khi giao (đơn CREDIT, hoặc đơn cọc ON_CREDIT); null nếu khác. */
  creditTermDays: z.number().int().nullable(),
  /** null khi đơn không cọc (hoặc dòng danh sách không mang field này). */
  balancePolicy: orderBalancePolicyDtoSchema.nullable(),
  warehouseId: z.string().nullable(),
  releasedAt: z.string().nullable(),
  cancellation: orderCancellationSchema.nullable(),
  // Vòng đời (BE PR #133)
  /** Staff: lý do đang giữ; null khi đơn không ON_HOLD. */
  holdReason: z.enum([...ORDER_HOLD_REASONS, ORDER_STATUS_UNKNOWN]).nullable(),
  holdReasonPublic: z.string().nullable(),
  /** Trạng thái FE đơn quay về khi gỡ giữ; null với giữ công nợ. */
  statusBeforeHold: z.enum(ORDER_READ_STATUSES).nullable(),
  holdNote: z.string().nullable(),
  packedAt: z.string().nullable(),
  shippedAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  deliveryFailureReason: orderDeliveryFailureReasonSchema.nullable(),
  completedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  billedAmount: z.number().nullable(),
  effectiveTotal: z.number().nullable(),
  amountDue: z.number().nullable(),
  amountDueBeforeHandover: z.number().nullable(),
  amountDueOnDelivery: z.number().nullable(),
  /** Rỗng khi BE không trả `shipments` (đơn chưa chia lô). */
  shipments: z.array(orderShipmentSchema),
  /** null = BE không trả (dòng danh sách) — màn chi tiết không đoán, ẩn điều khiển. */
  allowPartialShipment: z.boolean().nullable(),
  printLinesReady: z.boolean().nullable(),
  /** null = BE không trả (dòng danh sách) — màn chi tiết không đoán, ẩn điều khiển. */
  deliveryMode: orderDeliveryModeDtoSchema.nullable(),
  /** null = BE không trả; true = không còn đổi được hình thức giao. */
  deliveryModeLocked: z.boolean().nullable(),
  /** Tiền cọc cần có (đơn cọc) và lúc đã nhận; null = vắng (đơn không cọc / chưa nhận). */
  depositRequired: z.number().nullable(),
  depositReceivedAt: z.string().nullable(),
  /** Số dòng in (dòng có thiết kế đã khoá) — BE `Order#printLines`: release dòng in cần mẫu duyệt (BR-PRD-08). */
  printLineCount: z.number().int().nonnegative(),
});
