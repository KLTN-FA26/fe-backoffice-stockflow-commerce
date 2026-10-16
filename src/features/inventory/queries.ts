import { useQuery } from "@tanstack/react-query";

import { INVENTORY_QUERY_KEYS } from "@/constants/inventory";

import { useAppStore } from "@/lib/store/use-app-store";

import { getAdjustment, listAdjustments, listMovements } from "./api";

import type { AdjustmentListParams, MovementListParams } from "./types";

export const adjustmentKeys = {
  all: [INVENTORY_QUERY_KEYS.adjustments] as const,
  list: (params: AdjustmentListParams, warehouseId: string | null) =>
    [...adjustmentKeys.all, "list", warehouseId, params] as const,
  detail: (id: string, warehouseId: string | null) =>
    [...adjustmentKeys.all, "detail", warehouseId, id] as const,
};

export const movementKeys = {
  all: [INVENTORY_QUERY_KEYS.movements] as const,
  list: (params: MovementListParams, warehouseId: string | null) =>
    [...movementKeys.all, "list", warehouseId, params] as const,
};

export function useMovements(params: MovementListParams) {
  const warehouseId = useAppStore((state) => state.warehouseId);
  return useQuery({
    queryKey: movementKeys.list(params, warehouseId),
    queryFn: ({ signal }) => listMovements(params, signal),
    placeholderData: (previous, query) =>
      query?.queryKey[2] === warehouseId ? previous : undefined,
  });
}

export function useAdjustments(params: AdjustmentListParams) {
  const warehouseId = useAppStore((state) => state.warehouseId);
  return useQuery({
    queryKey: adjustmentKeys.list(params, warehouseId),
    queryFn: ({ signal }) => listAdjustments(params, signal),
    placeholderData: (previous, query) =>
      query?.queryKey[2] === warehouseId ? previous : undefined,
  });
}

export function useAdjustment(id: string) {
  const warehouseId = useAppStore((state) => state.warehouseId);
  return useQuery({
    queryKey: adjustmentKeys.detail(id, warehouseId),
    queryFn: ({ signal }) => getAdjustment(id, signal),
    enabled: Boolean(id),
  });
}
