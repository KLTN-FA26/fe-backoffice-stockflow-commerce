/**
 * Order — zod schemas + BR traceability.
 *
 * Hai lớp, KHÔNG trộn (api-conventions §3.1), mỗi lớp một file (giới hạn 200 dòng / file):
 * - DTO (`*DtoSchema`, file này): hình dạng BE trả về (`OrderResponse.java`). Parse MỘT lần ở `api.ts`.
 * - Model FE (`orderSchema`, `model-schemas.ts`): kiểu UI đọc, sau khi map status BE → FE.
 * - Lịch sử đơn (`history-schemas.ts`); input form gửi đi: giữ / gỡ giữ / giao thất bại / đóng phần còn
 *   lại / giao một phần / hình thức giao (`input-schemas.ts`), huỷ + duyệt công nợ (`action-schemas.ts`),
 *   release (`release-schemas.ts`). Credit hold: `credit-hold-schemas.ts`. Lệnh sản xuất: `production-schemas.ts`.
 */

import { z } from "zod";

import {
  ORDER_BALANCE_POLICIES,
  ORDER_DELIVERY_FAILURE_REASONS,
  ORDER_HOLD_REASONS,
  ORDER_SHIPMENT_STATUSES,
} from "@/constants/labels-order";
import {
  ORDER_PAYMENT_STATUS_UNKNOWN,
  ORDER_PAYMENT_STATUSES,
  ORDER_PAYMENT_TERMS,
} from "@/constants/orders";
import { ORDER_STATUS_UNKNOWN } from "@/constants/statuses";

import { uuid } from "@/lib/validation/primitives";

import { orderReleaseFactsShape } from "./delivery-mode-schemas";

/* ── DTO (BE wire) ───────────────────────────────────────────────────── */

/**
 * BE `OrderResponse.currency` — mã ISO 4217 bất kỳ (không chỉ VND/USD). Chỉ kiểm định dạng
 * để một mã lạ không làm hỏng cả trang danh sách; hiển thị qua `formatMoney`.
 */
export const currencyCode = z.string().regex(/^[A-Z]{3}$/, "Mã tiền tệ không hợp lệ");

/**
 * Enum BE dễ mở rộng (cùng tinh thần `deliveryStatus` của PO): chuỗi ngoài `values` → `fallback`
 * thay vì làm hỏng cả response. Khác `.catch()`: chỉ nhận CHUỖI — vắng key / null / sai kiểu ở
 * field bắt buộc vẫn fail (đó là bug hợp đồng, không phải giá trị mới). Field cho phép null thì
 * nối `.nullish()`.
 */
function tolerantEnum<const T extends readonly [string, ...string[]], const F>(
  values: T,
  fallback: F,
) {
  return z.union([z.enum(values), z.string().transform((): F => fallback)]);
}

/**
 * BE `order/api/OrderStatus.java` — đúng 19 giá trị (BE PR #133: bỏ IN_FULFILMENT / PAID, thêm PICKING,
 * PACKED, PARTIALLY_FULFILLED, DELIVERY_FAILED, RETURN_REQUESTED, REFUNDED, PARTIALLY_REFUNDED, CLOSED).
 * Đây là tập giá trị ĐƯỢC GỬI lên BE (lọc `status=`) — không bao giờ chứa `UNKNOWN`.
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

/**
 * Trạng thái đọc từ BE: mã đã biết, hoặc `UNKNOWN` cho chuỗi lạ — trạng thái BE thêm sau, hoặc mã đã
 * bị bỏ (IN_FULFILMENT / PAID) mà BE cũ còn trả. Thiếu / null / không phải chuỗi → parse fail.
 */
export const orderStatusDtoSchema = tolerantEnum(BACKEND_ORDER_STATUSES, ORDER_STATUS_UNKNOWN);

/** BE `HoldReason` — lý do lạ → `UNKNOWN` (không cho gỡ giữ, xem lifecycle). */
export const orderHoldReasonDtoSchema = tolerantEnum(ORDER_HOLD_REASONS, ORDER_STATUS_UNKNOWN);

/** BE `DeliveryFailureReason` — lý do lạ → `UNKNOWN`. */
export const orderDeliveryFailureReasonDtoSchema = tolerantEnum(
  ORDER_DELIVERY_FAILURE_REASONS,
  ORDER_STATUS_UNKNOWN,
);

/** BE `OrderShipmentStatus` — trạng thái lô lạ → `UNKNOWN`. */
export const orderShipmentStatusDtoSchema = tolerantEnum(
  ORDER_SHIPMENT_STATUSES,
  ORDER_STATUS_UNKNOWN,
);

/** BE `PaymentStatus` — giá trị lạ → `UNKNOWN` (hiển thị "Không rõ"). */
export const orderPaymentStatusDtoSchema = tolerantEnum(
  ORDER_PAYMENT_STATUSES,
  ORDER_PAYMENT_STATUS_UNKNOWN,
);

/** BE `PaymentTerm` — phương thức lạ → null ("chưa rõ phương thức"), KHÔNG thành lựa chọn mới. */
export const orderPaymentTermDtoSchema = tolerantEnum(ORDER_PAYMENT_TERMS, null);

/**
 * BE `BalancePolicy` — cách thu phần còn lại của đơn cọc (BE PR #150: thêm ON_CREDIT). Tolerant: giá trị
 * lạ → "UNKNOWN" (hiện "Không rõ"), không làm hỏng cả trang.
 */
export const orderBalancePolicyDtoSchema = z
  .enum([...ORDER_BALANCE_POLICIES, "UNKNOWN"])
  .catch("UNKNOWN");

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
  failureReason: orderDeliveryFailureReasonDtoSchema.nullish(),
  lines: z.array(orderShipmentLineDtoSchema).nullish(),
  /** Tiền hãng vận chuyển thu khi giao lô (đơn cọc ON_DELIVERY), chốt lúc bàn giao. */
  codAmount: z.number().nullish(),
});

/**
 * BE `OrderResponse.Cancellation` — có khi đơn CANCELLED. `reason` = "CODE" hoặc "CODE: ghi chú";
 * fee* chỉ có khi huỷ giữ khoản thoả thuận (decision Q2); `feeDetail` chỉ nhân viên đọc.
 */
export const orderCancellationDtoSchema = z.object({
  reasonCode: z.string().nullish(),
  reason: z.string().nullish(),
  retainedAmount: z.number().nullish(),
  feeReason: z.string().nullish(),
  feeDetail: z.string().nullish(),
  feeAmount: z.number().nullish(),
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
  // ── Thanh toán / release (SCRUM-423/427/460). Dòng danh sách có thể không mang một số field
  // ("null on list rows that do not carry it") → nullish.
  paymentTerm: orderPaymentTermDtoSchema.nullish(),
  /** Kho xuất — null tới khi release (SCRUM-423). */
  warehouseId: z.string().nullish(),
  releasedAt: z.string().nullish(),
  paidAmount: z.number().nullish(),
  paidInFullAt: z.string().nullish(),
  paymentStatus: orderPaymentStatusDtoSchema.nullish(),
  creditTermDays: z.number().int().nullish(),
  balancePolicy: orderBalancePolicyDtoSchema.nullish(),
  cancellation: orderCancellationDtoSchema.nullish(),
  // ── Vòng đời (BE PR #133). Field staff (holdReason, statusBeforeHold, holdNote) vắng với khách.
  /** Staff: lý do đang giữ (ON_HOLD); vắng với đơn không bị giữ. */
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
  // ── Tiền của đơn giao một phần
  /** Các lô giao đã ghi công nợ (đơn công nợ). */
  billedAmount: z.number().nullish(),
  /** Tổng trừ số đơn vị đã đóng ở đơn giao một phần. */
  effectiveTotal: z.number().nullish(),
  /** Khách còn nợ (effectiveTotal − paidAmount, không âm). */
  amountDue: z.number().nullish(),
  /** Phải trả trước khi hàng rời kho (G3-Q4): > 0 thì bàn giao bị từ chối. */
  amountDueBeforeHandover: z.number().nullish(),
  /** Hãng vận chuyển thu khi giao (đơn cọc ON_DELIVERY), 0 với đơn khác. */
  amountDueOnDelivery: z.number().nullish(),
  /** BE luôn gửi danh sách (rỗng khi chưa chia lô); nullish để dòng danh sách / BE cũ vẫn parse. */
  shipments: z.array(orderShipmentDtoSchema).nullish(),
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
  // Hình thức giao + khoá (BE PR #157) và tiền cọc (`depositRequired` / `depositReceivedAt`, BR-PRD-09)
  ...orderReleaseFactsShape,
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

/* ── Tham số lọc `GET /orders` ───────────────────────────────────────── */

/** BE `OrderController#list`: `@RequestParam UUID customerId` — giá trị khác → 400 UNSUPPORTED_PARAMETER. */
export const orderListCustomerIdSchema = uuid("ID khách hàng phải là UUID hợp lệ.");

export function isValidOrderCustomerId(value: string): boolean {
  return orderListCustomerIdSchema.safeParse(value).success;
}
