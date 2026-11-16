import { useQuery } from "@tanstack/react-query";

import { CYCLE_COUNT_QUERY_KEYS } from "@/constants/cycle-count";

import { useAppStore } from "@/lib/store/use-app-store";

import { getCycleCount, listCycleCounts } from "./cycle-count-api";

import type { CycleCountListParams } from "./cycle-count-types";

export const cycleCountKeys = {
  all: [CYCLE_COUNT_QUERY_KEYS.all] as const,
  list: (params: CycleCountListParams, warehouseId: string | null) =>
    [...cycleCountKeys.all, "list", warehouseId, params] as const,
  detail: (id: string, warehouseId: string | null) =>
    [...cycleCountKeys.all, "detail", warehouseId, id] as const,
};

export function useCycleCounts(params: CycleCountListParams) {
  const warehouseId = useAppStore((state) => state.warehouseId);
  return useQuery({
    queryKey: cycleCountKeys.list(params, warehouseId),
    queryFn: ({ signal }) => listCycleCounts(params, signal),
    placeholderData: (previous, query) =>
      query?.queryKey[2] === warehouseId ? previous : undefined,
  });
}

export function useCycleCount(id: string) {
  const warehouseId = useAppStore((state) => state.warehouseId);
  return useQuery({
    queryKey: cycleCountKeys.detail(id, warehouseId),
    queryFn: ({ signal }) => getCycleCount(id, signal),
    enabled: Boolean(id),
  });
}
