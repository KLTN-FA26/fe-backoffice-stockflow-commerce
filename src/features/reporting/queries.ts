import { useQuery } from "@tanstack/react-query";

import { REPORTING_LIMITS, REPORTING_QUERY_ROOT } from "@/constants/reporting";

import { QUERY_TIMES } from "@/lib/api/query-client";

import {
  fetchOrderStatusCounts,
  fetchSalesDaily,
  fetchSalesSummary,
  fetchTopProducts,
} from "./api";

import type { DateRange } from "./types";

export const reportingKeys = {
  all: [REPORTING_QUERY_ROOT] as const,
  salesDaily: (range: DateRange) => [REPORTING_QUERY_ROOT, "sales-daily", range] as const,
  topProducts: (range: DateRange, limit: number) =>
    [REPORTING_QUERY_ROOT, "top-products", range, limit] as const,
  orderStatusCounts: () => [REPORTING_QUERY_ROOT, "order-status-counts"] as const,
  summary: (range: DateRange) => [REPORTING_QUERY_ROOT, "summary", range] as const,
};

export function useSalesDaily(range: DateRange, enabled: boolean) {
  return useQuery({
    queryKey: reportingKeys.salesDaily(range),
    queryFn: ({ signal }) => fetchSalesDaily(range, signal),
    enabled,
    ...QUERY_TIMES.dashboard,
  });
}

export function useTopProducts(
  range: DateRange,
  enabled: boolean,
  limit: number = REPORTING_LIMITS.topProductsLimit,
) {
  return useQuery({
    queryKey: reportingKeys.topProducts(range, limit),
    queryFn: ({ signal }) => fetchTopProducts(range, limit, signal),
    enabled,
    ...QUERY_TIMES.dashboard,
  });
}

export function useOrderStatusCounts(enabled: boolean) {
  return useQuery({
    queryKey: reportingKeys.orderStatusCounts(),
    queryFn: ({ signal }) => fetchOrderStatusCounts(signal),
    enabled,
    ...QUERY_TIMES.dashboard,
  });
}

export function useSalesSummary(range: DateRange, enabled: boolean) {
  return useQuery({
    queryKey: reportingKeys.summary(range),
    queryFn: ({ signal }) => fetchSalesSummary(range, signal),
    enabled,
    ...QUERY_TIMES.dashboard,
  });
}
