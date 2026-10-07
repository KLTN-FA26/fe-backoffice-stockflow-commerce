/**
 * Order — zod schemas + BR traceability.
 *
 * Hai lớp, KHÔNG trộn (api-conventions §3.1):
 * - DTO (`*DtoSchema`): hình dạng BE trả về — `OrderResponse.java`
 *   (order/internal/controller/dto, BE develop). Parse MỘT lần ở `api.ts`.
 * - Model FE (`orderSchema`): kiểu UI đọc, sau khi map status BE → FE.
 * - Input (`adminCancelOrderSchema`): body form gửi đi.
 */

import { z } from "zod";

import { ORDER_LIMITS } from "@/constants/numbers";
import { ORDER_STATUSES } from "@/constants/statuses";

/* ── DTO (BE wire) ───────────────────────────────────────────────────── */

/**
 * BE `OrderResponse.currency` — mã ISO 4217 bất kỳ (không chỉ VND/USD). Chỉ kiểm định dạng
 * để một mã lạ không làm hỏng cả trang danh sách; hiển thị qua `formatMoney`.
 */
const currencyCode = z.string().regex(/^[A-Z]{3}$/, "Mã tiền tệ không hợp lệ");

/**
 * BE `order/api/OrderStatus.java` — 10 giá trị (ON_HOLD có từ BE commit 2e9c4df,
 * SCRUM-43). Giá trị lạ → parse fail ("Dữ liệu trả về không đúng định dạng").
 */
export const BACKEND_ORDER_STATUSES = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PAID",
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

export const orderLineSchema = orderLineDtoSchema.pick({
  lineId: true,
  sku: true,
  quantity: true,
  unitPrice: true,
  lineTotal: true,
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
});

/* ── Admin cancel input ──────────────────────────────────────────────── */

/**
 * Nguồn BE: OrderController#adminCancel — AdminCancelOrderRequest
 * (record AdminCancelOrderRequest(@NotBlank(message = "reason is required") String reason)).
 */
export const adminCancelOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Lý do huỷ là bắt buộc")
    // Cột cancellation_reason VARCHAR(500) — xem ORDER_LIMITS (BE không có @Size)
    .max(ORDER_LIMITS.cancelReasonMax, `Lý do huỷ tối đa ${ORDER_LIMITS.cancelReasonMax} ký tự`),
});

export type AdminCancelOrderInput = z.infer<typeof adminCancelOrderSchema>;
