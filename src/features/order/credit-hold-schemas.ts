/**
 * Credit hold (SCRUM-427) — DTO `GET /orders/credit-holds` + `GET /orders/credit-position/{id}`.
 *
 * BE `CreditHoldResponse(OrderResponse order, Instant checkedAt, BigDecimal creditLimit,
 * BigDecimal exposure, BigDecimal orderAmount)` — số liệu tại lúc kiểm hạn mức (docs 14 BR-06:
 * dư nợ hiện tại + giá trị đơn ≤ hạn mức, vượt → On Hold).
 */

import { z } from "zod";

import { ORDER_PAYMENT_TERMS } from "@/constants/orders";

import { orderDtoSchema, orderSchema } from "./schemas";

import type { OrderPaymentTerm } from "@/constants/orders";

export const creditHoldDtoSchema = z.object({
  order: orderDtoSchema,
  checkedAt: z.string(),
  creditLimit: z.number(),
  /** Dư nợ hiện tại của khách lúc kiểm. */
  exposure: z.number(),
  orderAmount: z.number(),
});

export const creditHoldPageDtoSchema = z.object({
  items: z.array(creditHoldDtoSchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
});

/** Model FE: đơn đã map + số liệu hạn mức + phần vượt (phái sinh, xem selectors). */
export const creditHoldSchema = z.object({
  order: orderSchema,
  checkedAt: z.string(),
  creditLimit: z.number(),
  exposure: z.number(),
  orderAmount: z.number(),
});

/* ── Credit position (SCRUM-427/193) ─────────────────────────────────── */

const isPaymentTerm = (value: string): value is OrderPaymentTerm =>
  (ORDER_PAYMENT_TERMS as readonly string[]).includes(value);

/**
 * BE `CreditPositionResponse` — `GET /orders/credit-position/{customerId}`: phương thức thanh toán
 * khách được dùng và công nợ HIỆN TẠI (không phải lý do một đơn cũ bị giữ). Tiền là BigDecimal →
 * số JSON, theo `currency` của hồ sơ khách. `depositPercent` là PHẦN TRĂM (30 = 30%, 0 < x < 100 —
 * ràng buộc DB `ck_credit_profile_deposit`). Field null bị BỎ khỏi JSON (Jackson non_null).
 * Khách chưa có hồ sơ: chỉ PREPAID, không cọc / hạn mức (BE `CreditTerms.prepaidOnly`).
 */
export const creditPositionDtoSchema = z.object({
  customerId: z.string(),
  // BE `List<String>` từ enum CommercialTerm. Mã FE chưa biết bị bỏ — không bao giờ thành lựa chọn
  // hay được gửi lên (chỉ dùng để bật cách xử lý FE đã hiểu).
  allowedTerms: z.array(z.string()).transform((terms) => terms.filter(isPaymentTerm)),
  defaultTerm: z
    .string()
    .nullish()
    .transform((term) => (term && isPaymentTerm(term) ? term : null)),
  depositPercent: z.number().nullish(),
  creditLimit: z.number().nullish(),
  creditTermDays: z.number().int().nullish(),
  /** Đang nợ trên đơn công nợ chưa giao + phải thu còn mở. */
  exposure: z.number(),
  /** Hạn mức − dư nợ (không âm); null khi khách không được bán công nợ. */
  availableCredit: z.number().nullish(),
  currency: z.string().regex(/^[A-Z]{3}$/, "Mã tiền tệ không hợp lệ"),
  /** Khách đang có khoản phải thu quá hạn — tình trạng HIỆN TẠI. */
  hasOverdue: z.boolean(),
});

/** Model FE: field vắng → null. */
export const creditPositionSchema = z.object({
  customerId: z.string(),
  allowedTerms: z.array(z.enum(ORDER_PAYMENT_TERMS)),
  defaultTerm: z.enum(ORDER_PAYMENT_TERMS).nullable(),
  depositPercent: z.number().nullable(),
  creditLimit: z.number().nullable(),
  creditTermDays: z.number().nullable(),
  exposure: z.number(),
  availableCredit: z.number().nullable(),
  currency: z.string(),
  hasOverdue: z.boolean(),
});
