/**
 * Order — zod schemas + BR traceability.
 *
 * Hai lớp, KHÔNG trộn (api-conventions §3.1), mỗi lớp một file (giới hạn 200 dòng / file):
 * - DTO (`*DtoSchema`, file này): hình dạng BE trả về (`OrderResponse.java`). Parse MỘT lần ở `api.ts`.
 * - Model FE (`orderSchema`, `model-schemas.ts`): kiểu UI đọc, sau khi map status BE → FE.
 * - Lịch sử đơn (`history-schemas.ts`) và input form gửi đi (`input-schemas.ts`).
 */

import { z } from "zod";

import {
  ORDER_BALANCE_POLICIES,
  ORDER_DELIVERY_FAILURE_REASONS,
  ORDER_HOLD_REASONS,
  ORDER_SHIPMENT_STATUSES,
} from "@/constants/labels-order";

/**
 * BE `OrderResponse.currency` — mã ISO 4217 bất kỳ (không chỉ VND/USD). Chỉ kiểm định dạng
 * để một mã lạ không làm hỏng cả trang danh sách; hiển thị qua `formatMoney`.
 */
export const currencyCode = z.string().regex(/^[A-Z]{3}$/, "Mã tiền tệ không hợp lệ");

/**
 * BE `order/api/OrderStatus.java` — 19 giá trị (BE PR #133: bỏ IN_FULFILMENT / PAID, thêm PICKING, PACKED,
 * PARTIALLY_FULFILLED, DELIVERY_FAILED, RETURN_REQUESTED, REFUNDED, PARTIALLY_REFUNDED, CLOSED…). Giá trị lạ → "UNKNOWN".
 */
export const BACKEND_ORDER_STATUSES = [
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
] as const;

export const orderStatusDtoSchema = z.enum([...BACKEND_ORDER_STATUSES, "UNKNOWN"]).catch("UNKNOWN");

/** BE `HoldReason` — tolerant: giá trị lạ → "UNKNOWN" (không cho phép gỡ giữ, xem lifecycle). */
export const orderHoldReasonDtoSchema = z.enum([...ORDER_HOLD_REASONS, "UNKNOWN"]).catch("UNKNOWN");

/** BE `DeliveryFailureReason` — tolerant. */
export const orderDeliveryFailureReasonDtoSchema = z
  .enum([...ORDER_DELIVERY_FAILURE_REASONS, "UNKNOWN"])
  .catch("UNKNOWN");

/**
 * BE `BalancePolicy` — cách thu phần còn lại của đơn cọc (BE PR #150: thêm ON_CREDIT). Tolerant: giá trị
 * lạ → "UNKNOWN" (hiện "Không rõ"), không làm hỏng cả trang.
 */
export const orderBalancePolicyDtoSchema = z
  .enum([...ORDER_BALANCE_POLICIES, "UNKNOWN"])
  .catch("UNKNOWN");

/** BE `OrderShipmentStatus` — tolerant. */
export const orderShipmentStatusDtoSchema = z.enum(ORDER_SHIPMENT_STATUSES).catch("UNKNOWN");

/**
 * Field có thể null dùng `.nullish()` (cho phép vắng key): BE bật Jackson
 * `default-property-inclusion: non_null` (application.yml) nên field null bị BỎ HẲN khỏi JSON
 * (vd đơn guest không có key `customerId`). Chỉ cho null mà bắt buộc có key → parse fail.
 */

/** BE `OrderResponse.Address` — mọi field có thể vắng (đơn guest/địa chỉ thiếu). */
export const orderAddressDtoSchema = z.object({
  recipientName: z.string().nullish(),
  phone: z.string().nullish(),
  line1: z.string().nullish(),
  line2: z.string().nullish(),
  wardCode: z.string().nullish(),
  wardName: z.string().nullish(),
  provinceCode: z.string().nullish(),
  provinceName: z.string().nullish(),
  countryCode: z.string().nullish(),
  postalCode: z.string().nullish(),
});

/** BE `OrderResponse.Line` — tiền là BigDecimal, JSON ra number. */
export const orderLineDtoSchema = z.object({
  lineId: z.string(),
  sku: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  lineTotal: z.number(),
  reservationIds: z.array(z.string()).default([]),
  designSnapshotId: z.string().nullish(),
  designChecksum: z.string().nullish(),
  /** Số đơn vị nằm trong lô còn ở hãng vận chuyển / khách (BE PR #133, omit khi null). */
  shippedQuantity: z.number().int().nullish(),
  /** Số đơn vị ở các lô đã giao. */
  deliveredQuantity: z.number().int().nullish(),
  /** Số đơn vị đã đóng ở đơn giao một phần — sẽ không được giao. */
  cancelledQuantity: z.number().int().nullish(),
});

/** BE `OrderResponse.ShipmentLine`. */
export const orderShipmentLineDtoSchema = z.object({
  lineId: z.string(),
  quantity: z.number().int(),
});

/** BE `OrderResponse.Shipment` — lô giao của đơn (split shipments, G4-Q3). */
export const orderShipmentDtoSchema = z.object({
  shipmentId: z.string(),
  status: orderShipmentStatusDtoSchema,
  /** Giá trị hàng của lô theo giá đơn. */
  amount: z.number().nullish(),
  /** Số tiền giao lô này đã ghi nhận công nợ (đơn công nợ). */
  billedAmount: z.number().nullish(),
  handedOverAt: z.string().nullish(),
  outcomeAt: z.string().nullish(),
  failureReason: z.string().nullish(),
  lines: z.array(orderShipmentLineDtoSchema).nullish(),
});

export const orderDtoSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string().nullish(),
  status: orderStatusDtoSchema,
  totalAmount: z.number(),
  currency: currencyCode,
  lines: z.array(orderLineDtoSchema),
  placedAt: z.string(),
  createdBy: z.string().nullish(),
  lastModifiedAt: z.string().nullish(),
  lastModifiedBy: z.string().nullish(),
  contactName: z.string().nullish(),
  contactEmail: z.string().nullish(),
  contactPhone: z.string().nullish(),
  shippingAddress: orderAddressDtoSchema.nullish(),
  billingAddress: orderAddressDtoSchema.nullish(),
  /** BE `PaymentTerm`: PREPAID | DEPOSIT | CREDIT; null trên dòng danh sách không mang field này. */
  paymentTerm: z.string().nullish(),
  /** Staff: lý do đang giữ (ON_HOLD); null/vắng với đơn không bị giữ. */
  holdReason: orderHoldReasonDtoSchema.nullish(),
  /** Lý do giữ khách được đọc (AWAITING_CREDIT_APPROVAL | UNDER_REVIEW). */
  holdReasonPublic: z.string().nullish(),
  /** Staff: trạng thái đơn sẽ quay về khi gỡ giữ; vắng với giữ công nợ. */
  statusBeforeHold: orderStatusDtoSchema.nullish(),
  /** Staff: ghi chú lúc giữ. */
  holdNote: z.string().nullish(),
  packedAt: z.string().nullish(),
  shippedAt: z.string().nullish(),
  deliveredAt: z.string().nullish(),
  deliveryFailureReason: orderDeliveryFailureReasonDtoSchema.nullish(),
  completedAt: z.string().nullish(),
  closedAt: z.string().nullish(),
  /** Các lô giao đã ghi công nợ (đơn công nợ). */
  billedAmount: z.number().nullish(),
  /** Tổng trừ số đơn vị đã đóng ở đơn giao một phần. */
  effectiveTotal: z.number().nullish(),
  /** Khách còn nợ (effectiveTotal − paidAmount, không âm). */
  amountDue: z.number().nullish(),
  /** Phải trả trước khi hàng rời kho (G3-Q4): > 0 thì bàn giao bị từ chối. */
  amountDueBeforeHandover: z.number().nullish(),
  shipments: z.array(orderShipmentDtoSchema).nullish(),
  /**
   * Cách thu phần còn lại của đơn cọc: BEFORE_DELIVERY | ON_DELIVERY | ON_CREDIT; null với đơn không
   * cọc (BE PR #150).
   */
  balancePolicy: orderBalancePolicyDtoSchema.nullish(),
  /** Số ngày trả sau khi giao (đơn CREDIT, hoặc đơn cọc ON_CREDIT); null nếu khác. */
  creditTermDays: z.number().int().nullish(),
  /**
   * Sales cho phép giao một phần (PACK-PARTIAL, BE PR #150); mặc định false. Vắng (null) trên dòng
   * danh sách không mang field này.
   */
  allowPartialShipment: z.boolean().nullish(),
  /**
   * Hàng in của đơn đã về bàn đóng gói (không có dòng in, hoặc sản xuất xong). False khi đơn còn đang in,
   * hoặc đã giao hàng có sẵn trước khi sản xuất xong (PACK-EARLY); vắng trên dòng danh sách.
   */
  printLinesReady: z.boolean().nullish(),
});

/** BE `PageResponse<OrderResponse>` — trang đánh số từ 0. */
export const orderPageDtoSchema = z.object({
  items: z.array(orderDtoSchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
});
