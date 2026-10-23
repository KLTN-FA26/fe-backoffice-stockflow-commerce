/**
 * Order — zod schemas + BR traceability.
 *
 * Hai lớp, KHÔNG trộn (api-conventions §3.1):
 * - DTO (`*DtoSchema`): hình dạng BE trả về — `OrderResponse.java`, `OrderStatusChangeResponse.java`
 *   (order/internal/controller/dto, BE develop sau PR #133). Parse MỘT lần ở `api.ts`.
 * - Model FE (`orderSchema`…): kiểu UI đọc, sau khi map status BE → FE.
 * - Input (release / credit / huỷ / giữ / gỡ giữ / giao thất bại / đóng phần còn lại):
 *   `action-schemas.ts`. Credit hold: `credit-hold-schemas.ts`. Lệnh sản xuất: `production-schemas.ts`.
 */

import { z } from "zod";

import {
  ORDER_DELIVERY_FAILURE_REASONS,
  ORDER_HOLD_REASONS,
  ORDER_SHIPMENT_READ_STATUSES,
  ORDER_SHIPMENT_STATUSES,
} from "@/constants/labels-order";
import {
  ORDER_BALANCE_POLICIES,
  ORDER_PAYMENT_READ_STATUSES,
  ORDER_PAYMENT_STATUS_UNKNOWN,
  ORDER_PAYMENT_STATUSES,
  ORDER_PAYMENT_TERMS,
} from "@/constants/orders";
import { ORDER_READ_STATUSES, ORDER_STATUS_UNKNOWN } from "@/constants/statuses";

import { uuid } from "@/lib/validation/primitives";

/* ── DTO (BE wire) ───────────────────────────────────────────────────── */

/**
 * BE `OrderResponse.currency` — mã ISO 4217 bất kỳ (không chỉ VND/USD). Chỉ kiểm định dạng
 * để một mã lạ không làm hỏng cả trang danh sách; hiển thị qua `formatMoney`.
 */
const currencyCode = z.string().regex(/^[A-Z]{3}$/, "Mã tiền tệ không hợp lệ");

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

/** BE `BalancePolicy` (G2-3) — giá trị lạ → null. */
export const orderBalancePolicyDtoSchema = tolerantEnum(ORDER_BALANCE_POLICIES, null);

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
  /** Tiền cọc cần có trước khi Confirmed — chỉ đơn DEPOSIT. */
  depositRequired: z.number().nullish(),
  depositReceivedAt: z.string().nullish(),
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

/**
 * BE `OrderStatusChangeResponse` — `GET /orders/{id}/history`, cũ → mới; `from` vắng ở bước đầu.
 * Trạng thái lạ ở `from` / `to` → `UNKNOWN`, không làm hỏng cả lịch sử. `actorId` / `actorName`
 * (G3-2): ai đổi — chỉ nhân viên đọc; vắng với hệ thống và bước ghi trước G3-2.
 */
export const orderStatusChangeDtoSchema = z.object({
  from: orderStatusDtoSchema.nullish(),
  to: orderStatusDtoSchema,
  reason: z.string().nullish(),
  occurredAt: z.string(),
  actorId: z.string().nullish(),
  actorName: z.string().nullish(),
});

/* ── Tham số lọc `GET /orders` ───────────────────────────────────────── */

/** BE `OrderController#list`: `@RequestParam UUID customerId` — giá trị khác → 400 UNSUPPORTED_PARAMETER. */
export const orderListCustomerIdSchema = uuid("ID khách hàng phải là UUID hợp lệ.");

export function isValidOrderCustomerId(value: string): boolean {
  return orderListCustomerIdSchema.safeParse(value).success;
}

/* ── Model FE ────────────────────────────────────────────────────────── */

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
  /** null khi BE không trả (dòng danh sách / BE cũ). */
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
  failureReason: z.enum([...ORDER_DELIVERY_FAILURE_REASONS, ORDER_STATUS_UNKNOWN]).nullable(),
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
  depositRequired: z.number().nullable(),
  depositReceivedAt: z.string().nullable(),
  paidInFullAt: z.string().nullable(),
  creditTermDays: z.number().nullable(),
  balancePolicy: z.enum(ORDER_BALANCE_POLICIES).nullable(),
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
  deliveryFailureReason: z
    .enum([...ORDER_DELIVERY_FAILURE_REASONS, ORDER_STATUS_UNKNOWN])
    .nullable(),
  completedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  billedAmount: z.number().nullable(),
  effectiveTotal: z.number().nullable(),
  amountDue: z.number().nullable(),
  amountDueBeforeHandover: z.number().nullable(),
  amountDueOnDelivery: z.number().nullable(),
  /** Rỗng khi BE không trả `shipments` (đơn chưa chia lô). */
  shipments: z.array(orderShipmentSchema),
});

export const orderStatusChangeSchema = z.object({
  from: z.enum(ORDER_READ_STATUSES).nullable(),
  to: z.enum(ORDER_READ_STATUSES),
  reason: z.string().nullable(),
  occurredAt: z.string(),
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
});
