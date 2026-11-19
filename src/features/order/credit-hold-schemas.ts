/**
 * Credit hold (SCRUM-427) — DTO `GET /orders/credit-holds` + `GET /orders/credit-position/{id}`.
 *
 * BE `CreditHoldResponse(OrderResponse order, Instant checkedAt, BigDecimal creditLimit,
 * BigDecimal exposure, BigDecimal orderAmount)` — số liệu tại lúc kiểm hạn mức (docs 14 BR-06:
 * dư nợ hiện tại + giá trị đơn ≤ hạn mức, vượt → On Hold).
 */

import { z } from "zod";

import { orderSchema } from "./model-schemas";
import { orderDtoSchema } from "./schemas";

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

/* ── Credit position (BE CreditPositionResponse, origin/develop 438fe6fb) ── */

/**
 * BE `CreditPositionResponse` — `GET /orders/credit-position/{customerId}`: hạn mức, dư nợ phần trả sau giao
 * và khoản quá hạn HIỆN TẠI (15 BR-10). Không còn điều khoản thanh toán (`allowedTerms`, `defaultTerm` đã bỏ ở
 * BE). Field null bị BỎ khỏi JSON (Jackson non_null): `creditLimit`, `creditTermDays`, `availableCredit` vắng
 * khi khách không được bán trả sau; `oldestOverdueDueDate` vắng khi không có quá hạn.
 */
export const creditPositionDtoSchema = z.object({
  customerId: z.string(),
  creditLimit: z.number().nullish(),
  creditTermDays: z.number().int().nullish(),
  /** Phần trả sau giao của hợp đồng đã ký còn nợ + phí huỷ chưa trả. */
  exposure: z.number(),
  /** Hạn mức − dư nợ (không âm); null khi khách không được bán trả sau. */
  availableCredit: z.number().nullish(),
  currency: z.string().regex(/^[A-Z]{3}$/, "Mã tiền tệ không hợp lệ"),
  /** Đang có đợt thanh toán quá hạn — ký hợp đồng lúc này sẽ treo chờ Kế toán duyệt. */
  hasOverdue: z.boolean(),
  /** Số còn phải trả trên các đợt quá hạn; 0 khi không có. */
  overdueAmount: z.number().nullish(),
  oldestOverdueDueDate: z.string().nullish(),
});

/** Model FE: field vắng → null. */
export const creditPositionSchema = z.object({
  customerId: z.string(),
  creditLimit: z.number().nullable(),
  creditTermDays: z.number().nullable(),
  exposure: z.number(),
  availableCredit: z.number().nullable(),
  currency: z.string(),
  hasOverdue: z.boolean(),
  overdueAmount: z.number(),
  oldestOverdueDueDate: z.string().nullable(),
});
