/**
 * Credit hold (SCRUM-427) — DTO `GET /orders/credit-holds`.
 *
 * BE `CreditHoldResponse(OrderResponse order, Instant checkedAt, BigDecimal creditLimit,
 * BigDecimal exposure, BigDecimal orderAmount)` — số liệu tại lúc kiểm hạn mức (docs 14 BR-06:
 * dư nợ hiện tại + giá trị đơn ≤ hạn mức, vượt → On Hold).
 */

import { z } from "zod";

import { orderDtoSchema, orderSchema } from "./schemas";

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
