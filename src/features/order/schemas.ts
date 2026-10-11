/**
 * Order — zod schemas + BR traceability.
 *
 * Hai lớp, KHÔNG trộn (api-conventions §3.1):
 * - DTO (`*DtoSchema`): hình dạng BE trả về — `OrderResponse.java`
 *   (order/internal/controller/dto, BE develop). Parse MỘT lần ở `api.ts`.
 * - Model FE (`orderSchema`): kiểu UI đọc, sau khi map status BE → FE.
 * - Input (release / credit / huỷ): `action-schemas.ts`. Credit hold: `credit-hold-schemas.ts`.
 *   Lệnh sản xuất (chưa có API BE): `production-schemas.ts`.
 */

import { z } from "zod";

import { ORDER_PAYMENT_STATUSES, ORDER_PAYMENT_TERMS } from "@/constants/orders";
import { ORDER_STATUSES } from "@/constants/statuses";

/* ── DTO (BE wire) ───────────────────────────────────────────────────── */

/**
 * BE `OrderResponse.currency` — mã ISO 4217 bất kỳ (không chỉ VND/USD). Chỉ kiểm định dạng
 * để một mã lạ không làm hỏng cả trang danh sách; hiển thị qua `formatMoney`.
 */
const currencyCode = z.string().regex(/^[A-Z]{3}$/, "Mã tiền tệ không hợp lệ");

/**
 * BE `order/api/OrderStatus.java` (develop) — 12 giá trị; SCRUM-460 bỏ PAID → CONFIRMED,
 * SCRUM-423 thêm IN_PRODUCTION / READY_TO_FULFILL. Giá trị lạ → parse fail
 * ("Dữ liệu trả về không đúng định dạng").
 */
export const BACKEND_ORDER_STATUSES = [
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
] as const;

export const orderStatusDtoSchema = z.enum(BACKEND_ORDER_STATUSES);

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
  // ── Thanh toán / release / huỷ (SCRUM-423/427/460). Dòng danh sách có thể không mang
  // một số field ("null on list rows that do not carry it") → nullish.
  paymentTerm: z.enum(ORDER_PAYMENT_TERMS).nullish(),
  /** Kho xuất — null tới khi release (SCRUM-423). */
  warehouseId: z.string().nullish(),
  releasedAt: z.string().nullish(),
  paidAmount: z.number().nullish(),
  /** Tiền cọc cần có trước khi Confirmed — chỉ đơn DEPOSIT. */
  depositRequired: z.number().nullish(),
  depositReceivedAt: z.string().nullish(),
  paidInFullAt: z.string().nullish(),
  paymentStatus: z.enum(ORDER_PAYMENT_STATUSES).nullish(),
  creditTermDays: z.number().int().nullish(),
  cancellation: z
    .object({
      reasonCode: z.string().nullish(),
      reason: z.string().nullish(),
      retainedAmount: z.number().nullish(),
    })
    .nullish(),
});

/** BE `OrderStatusChangeResponse` — `GET /orders/{id}/history`, cũ → mới; `from` null ở bước đầu. */
export const orderStatusChangeDtoSchema = z.object({
  from: orderStatusDtoSchema.nullish(),
  to: orderStatusDtoSchema,
  reason: z.string().nullish(),
  occurredAt: z.string(),
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
});

/**
 * Kiểu UI đọc. Người nhận lấy từ `shippingAddress`, fallback `contact*`.
 * BE không trả subtotal/phí ship/thuế/giảm giá → UI không hiển thị các field đó (không bịa số).
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
  paymentTerm: z.enum(ORDER_PAYMENT_TERMS).nullable(),
  paymentStatus: z.enum(ORDER_PAYMENT_STATUSES).nullable(),
  paidAmount: z.number().nullable(),
  depositRequired: z.number().nullable(),
  depositReceivedAt: z.string().nullable(),
  paidInFullAt: z.string().nullable(),
  creditTermDays: z.number().nullable(),
  warehouseId: z.string().nullable(),
  releasedAt: z.string().nullable(),
  cancellation: z
    .object({
      reasonCode: z.string().nullable(),
      reason: z.string().nullable(),
      retainedAmount: z.number().nullable(),
    })
    .nullable(),
});

export const orderStatusChangeSchema = z.object({
  from: z.enum(ORDER_STATUSES).nullable(),
  to: z.enum(ORDER_STATUSES),
  reason: z.string().nullable(),
  occurredAt: z.string(),
});
