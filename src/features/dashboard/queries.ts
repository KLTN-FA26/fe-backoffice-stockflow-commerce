import { useQuery } from "@tanstack/react-query";

import { DASHBOARD_QUERY_KEYS } from "@/constants/dashboard";

import { QUERY_TIMES } from "@/lib/api/query-client";

import { fetchCount } from "./api";

import type { CountSource } from "./types";

export const dashboardKeys = {
  count: (source: CountSource) => [DASHBOARD_QUERY_KEYS.count, source] as const,
};

export function useKpiCount(source: CountSource, enabled: boolean) {
  return useQuery({
    queryKey: dashboardKeys.count(source),
    queryFn: ({ signal }) => fetchCount(source, signal),
    enabled,
    ...QUERY_TIMES.dashboard,
  });
}
