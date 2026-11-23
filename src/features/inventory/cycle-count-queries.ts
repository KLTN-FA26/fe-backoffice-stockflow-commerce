import { useQuery } from "@tanstack/react-query";

import { CYCLE_COUNT_QUERY_KEYS } from "@/constants/cycle-count";

import { getCycleCount, listCycleCountAssignees, listCycleCounts } from "./cycle-count-api";

import type { CycleCountListParams } from "./cycle-count-types";

export const cycleCountKeys = {
  all: [CYCLE_COUNT_QUERY_KEYS.all] as const,
  list: (params: CycleCountListParams) => [...cycleCountKeys.all, "list", params] as const,
  lists: () => [...cycleCountKeys.all, "list"] as const,
  assignees: (warehouseId: string) => [...cycleCountKeys.all, "assignees", warehouseId] as const,
  detail: (id: string) => [...cycleCountKeys.all, "detail", id] as const,
};

/** Phiếu của một kho (`params.warehouseId` = kho của tab theo kho); đổi trang / lọc giữ dữ liệu cũ của cùng kho. */
export function useCycleCounts(params: CycleCountListParams) {
  return useQuery({
    queryKey: cycleCountKeys.list(params),
    queryFn: ({ signal }) => listCycleCounts(params, signal),
    placeholderData: (previous, query) => {
      const last = query?.queryKey[2];
      return typeof last === "object" &&
        last !== null &&
        "warehouseId" in last &&
        last.warehouseId === params.warehouseId
        ? previous
        : undefined;
    },
  });
}

export function useCycleCount(id: string) {
  return useQuery({
    queryKey: cycleCountKeys.detail(id),
    queryFn: ({ signal }) => getCycleCount(id, signal),
    enabled: Boolean(id),
  });
}

/** Người đếm của kho đang lập phiếu; chưa chọn kho / không có quyền lập phiếu thì không gọi. */
export function useCycleCountAssignees(warehouseId: string, enabled = true) {
  return useQuery({
    queryKey: cycleCountKeys.assignees(warehouseId),
    queryFn: ({ signal }) => listCycleCountAssignees(warehouseId, signal),
    enabled: enabled && Boolean(warehouseId),
  });
}
