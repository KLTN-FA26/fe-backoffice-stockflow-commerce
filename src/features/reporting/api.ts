import { REPORTING_API, REPORTING_LIMITS } from "@/constants/reporting";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import {
  orderStatusCountListDto,
  rebuildResultDto,
  salesDailyListDto,
  salesSummaryDto,
  topProductListDto,
} from "./schemas";

import type { z } from "zod";
import type {
  DateRange,
  OrderStatusCount,
  RebuildResult,
  SalesDaily,
  SalesSummary,
  TopProduct,
} from "./types";

function parseContract<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError(502, "INVALID_REPORT_CONTRACT", "Dữ liệu trả về không đúng định dạng");
  }
  return result.data;
}

/** `GET /reports/sales-daily` — one row per day, zero-filled. */
export async function fetchSalesDaily(
  range: DateRange,
  signal?: AbortSignal,
): Promise<SalesDaily[]> {
  const { data } = await api.get<unknown>(REPORTING_API.salesDaily, { params: range, signal });
  return parseContract(salesDailyListDto, data);
}

/** `GET /reports/top-products` — ranked by revenue. */
export async function fetchTopProducts(
  range: DateRange,
  limit: number = REPORTING_LIMITS.topProductsLimit,
  signal?: AbortSignal,
): Promise<TopProduct[]> {
  const { data } = await api.get<unknown>(REPORTING_API.topProducts, {
    params: { ...range, limit },
    signal,
  });
  return parseContract(topProductListDto, data);
}

/** `GET /reports/order-status-counts` — every status, zeros included (not range-bound). */
export async function fetchOrderStatusCounts(signal?: AbortSignal): Promise<OrderStatusCount[]> {
  const { data } = await api.get<unknown>(REPORTING_API.orderStatusCounts, { signal });
  return parseContract(orderStatusCountListDto, data);
}

/** `GET /reports/summary` — current period against the previous one of equal length. */
export async function fetchSalesSummary(
  range: DateRange,
  signal?: AbortSignal,
): Promise<SalesSummary> {
  const { data } = await api.get<unknown>(REPORTING_API.summary, { params: range, signal });
  return parseContract(salesSummaryDto, data);
}

/** `POST /reports/rebuild` — recompute the daily aggregates from orders (admin maintenance). */
export async function rebuildReports(range: DateRange): Promise<RebuildResult> {
  const { data } = await api.post<unknown>(REPORTING_API.rebuild, null, { params: range });
  return parseContract(rebuildResultDto, data);
}
