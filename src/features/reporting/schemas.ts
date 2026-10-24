import { z } from "zod";

import { isoDate } from "@/lib/validation/primitives";

// BE `ReportController` (be-backoffice PR #170): Jackson NON_NULL omits null fields, so optional
// fields are `.optional()`; revenue is whole VND. Status codes stay open strings so a status added
// by the BE later does not break the dashboard.

export const salesDailyDto = z.object({
  day: isoDate,
  ordersCount: z.number().int().nonnegative(),
  revenue: z.number().nonnegative(),
  currency: z.string(),
});
export const salesDailyListDto = z.array(salesDailyDto);

export const topProductDto = z.object({
  sku: z.string(),
  productName: z.string().optional(),
  quantitySold: z.number().int().nonnegative(),
  revenue: z.number().nonnegative(),
});
export const topProductListDto = z.array(topProductDto);

export const orderStatusCountDto = z.object({
  status: z.string(),
  count: z.number().int().nonnegative(),
});
export const orderStatusCountListDto = z.array(orderStatusCountDto);

const periodTotalsDto = z.object({
  ordersCount: z.number().int().nonnegative(),
  revenue: z.number().nonnegative(),
  averageOrderValue: z.number().nonnegative(),
});

export const salesSummaryDto = z.object({
  from: isoDate,
  to: isoDate,
  previousFrom: isoDate,
  previousTo: isoDate,
  currency: z.string(),
  current: periodTotalsDto,
  previous: periodTotalsDto,
  // Omitted when the previous period has no base to compare against.
  ordersChangePercent: z.number().optional(),
  revenueChangePercent: z.number().optional(),
  averageOrderValueChangePercent: z.number().optional(),
});

export const rebuildResultDto = z.object({
  from: isoDate,
  to: isoDate,
  days: z.number().int().nonnegative(),
  ordersSeen: z.number().int().nonnegative(),
  ordersCounted: z.number().int().nonnegative(),
});
