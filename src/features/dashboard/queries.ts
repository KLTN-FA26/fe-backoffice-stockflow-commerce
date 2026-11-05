import { useQuery } from "@tanstack/react-query";

import { DASHBOARD_QUERY_KEYS } from "@/constants/dashboard";

import { QUERY_TIMES } from "@/lib/api/query-client";

import { fetchAlertSummary, fetchCount, listOpenAlerts } from "./api";

import type { CountSource } from "./types";

export const dashboardKeys = {
  count: (source: CountSource) => [DASHBOARD_QUERY_KEYS.count, source] as const,
  alertSummary: () => [DASHBOARD_QUERY_KEYS.alertSummary] as const,
  alerts: () => [DASHBOARD_QUERY_KEYS.alerts] as const,
};

export function useKpiCount(source: CountSource, enabled: boolean) {
  return useQuery({
    queryKey: dashboardKeys.count(source),
    queryFn: ({ signal }) => fetchCount(source, signal),
    enabled,
    ...QUERY_TIMES.dashboard,
  });
}

export function useAlertSummary(enabled: boolean) {
  return useQuery({
    queryKey: dashboardKeys.alertSummary(),
    queryFn: ({ signal }) => fetchAlertSummary(signal),
    enabled,
    ...QUERY_TIMES.dashboard,
  });
}

export function useOpenAlerts(enabled: boolean) {
  return useQuery({
    queryKey: dashboardKeys.alerts(),
    queryFn: ({ signal }) => listOpenAlerts(signal),
    enabled,
    ...QUERY_TIMES.dashboard,
  });
}
