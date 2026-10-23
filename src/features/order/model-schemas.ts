/**
 * Order — model FE (kiểu UI đọc, sau khi map status BE → FE). DTO ở `schemas.ts`.
 */

import { z } from "zod";

import { ORDER_STATUSES } from "@/constants/statuses";

import { orderDeliveryModeDtoSchema } from "./delivery-mode-schemas";
import {
  currencyCode,
  orderBalancePolicyDtoSchema,
  orderDeliveryFailureReasonDtoSchema,
  orderHoldReasonDtoSchema,
  orderLineDtoSchema,
  orderShipmentLineDtoSchema,
  orderShipmentStatusDtoSchema,
} from "./schemas";

export const orderLineSchema = orderLineDtoSchema
  .pick({
    lineId: true,
    sku: true,
    quantity: true,
    unitPrice: true,
    lineTotal: true,
  })
  .extend({
    /** null khi BE không trả (đơn chưa có lô giao). */
    shippedQuantity: z.number().int().nullable(),
    deliveredQuantity: z.number().int().nullable(),
    cancelledQuantity: z.number().int().nullable(),
  });

export const orderShipmentSchema = z.object({
  shipmentId: z.string(),
  status: orderShipmentStatusDtoSchema,
  amount: z.number().nullable(),
  billedAmount: z.number().nullable(),
  handedOverAt: z.string().nullable(),
  outcomeAt: z.string().nullable(),
  failureReason: z.string().nullable(),
  lines: z.array(orderShipmentLineDtoSchema),
});

/**
 * Kiểu UI đọc. Người nhận lấy từ `shippingAddress`, fallback `contact*`.
 * BE không trả subtotal/phí ship/thuế/giảm giá/phương thức thanh toán/kho xử lý
 * → UI không hiển thị các field đó (không bịa số).
 */
export const orderSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string().nullable(),
  status: z.enum(ORDER_STATUSES),
  totalAmount: z.number(),
  currency: currencyCode,
  placedAt: z.string(),
  recipientName: z.string(),
  recipientPhone: z.string(),
  contactEmail: z.string().nullable(),
  /** Địa chỉ giao đã ghép sẵn (line1, line2, phường/xã, tỉnh); null khi BE không có. */
  shippingAddressText: z.string().nullable(),
  lines: z.array(orderLineSchema),
  paymentTerm: z.string().nullable(),
  /** Staff: lý do đang giữ; null khi đơn không ON_HOLD. */
  holdReason: orderHoldReasonDtoSchema.nullable(),
  holdReasonPublic: z.string().nullable(),
  /** Trạng thái FE đơn quay về khi gỡ giữ; null với giữ công nợ. */
  statusBeforeHold: z.enum(ORDER_STATUSES).nullable(),
  holdNote: z.string().nullable(),
  packedAt: z.string().nullable(),
  shippedAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  deliveryFailureReason: orderDeliveryFailureReasonDtoSchema.nullable(),
  completedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  billedAmount: z.number().nullable(),
  effectiveTotal: z.number().nullable(),
  amountDue: z.number().nullable(),
  amountDueBeforeHandover: z.number().nullable(),
  /** Rỗng khi BE không trả `shipments` (đơn chưa chia lô). */
  shipments: z.array(orderShipmentSchema),
  /** null khi đơn không cọc (hoặc dòng danh sách không mang field này). */
  balancePolicy: orderBalancePolicyDtoSchema.nullable(),
  creditTermDays: z.number().int().nullable(),
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
