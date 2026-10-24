import { useQuery } from "@tanstack/react-query";

import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";
import { QUERY_TIMES } from "@/lib/api/query-client";

import {
  getLoadPlan,
  getLoadPlanLayouts,
  getLoadPlanReconciliation,
  listActiveVehicleTypes,
  listLoadPlanCandidates,
  listLoadPlans,
  listTransferPlanCandidates,
} from "./api";

import type { ListLoadPlanParams } from "./api";
import type { PlanDetail, PlanRow } from "./plan-types";

/**
 * Khoá gốc `fulfillment-load-plans`: mọi mutation làm mới danh sách, chi tiết, bố cục, đối chiếu và danh sách lô ứng
 * viên (kiện được giữ / thả) qua `all`.
 */
export const loadPlanKeys = {
  ...createQueryKeys<ListLoadPlanParams>("fulfillment-load-plans"),
  layouts: (id: string) => ["fulfillment-load-plans", "layouts", id] as const,
  reconciliation: (id: string) => ["fulfillment-load-plans", "reconciliation", id] as const,
  candidates: (warehouseId: string, loadPlanId = "") =>
    ["fulfillment-load-plans", "candidates", warehouseId, loadPlanId] as const,
  transferCandidates: (warehouseId: string, loadPlanId = "") =>
    ["fulfillment-load-plans", "candidates", "TRANSFER", warehouseId, loadPlanId] as const,
  vehicleTypes: ["fulfillment-load-plans", "vehicle-types"] as const,
};

export const useLoadPlans = createListQuery<PlanRow, ListLoadPlanParams>(
  loadPlanKeys,
  listLoadPlans,
);

export const useLoadPlan = createDetailQuery<PlanDetail>(loadPlanKeys, getLoadPlan);

/** Bố cục các xe; chỉ tải khi kế hoạch đã có xe. */
export function useLoadPlanLayouts(id: string, enabled: boolean) {
  return useQuery({
    queryKey: loadPlanKeys.layouts(id),
    queryFn: ({ signal }) => getLoadPlanLayouts(id, signal),
    enabled: enabled && !!id,
    ...QUERY_TIMES.detail,
  });
}

export function useLoadPlanReconciliation(id: string, enabled: boolean) {
  return useQuery({
    queryKey: loadPlanKeys.reconciliation(id),
    queryFn: ({ signal }) => getLoadPlanReconciliation(id, signal),
    enabled: enabled && !!id,
    ...QUERY_TIMES.detail,
  });
}

/** Lô giao nguyên xe chờ xuất của kho; `loadPlanId` tính kiện của chính kế hoạch đó là còn trống. */
export function useLoadPlanCandidates(warehouseId: string, loadPlanId?: string, enabled = true) {
  return useQuery({
    queryKey: loadPlanKeys.candidates(warehouseId, loadPlanId),
    queryFn: ({ signal }) => listLoadPlanCandidates(warehouseId, loadPlanId, signal),
    enabled: !!warehouseId && enabled,
    // Người khác lập kế hoạch cùng lúc thì lô biến mất khỏi danh sách: không giữ bản cũ lâu
    ...QUERY_TIMES.tracking,
  });
}

/** Lệnh chuyển kho đã đóng gói chờ lập kế hoạch xe của kho (BE PR #164); `enabled` tắt khi đang chọn nguồn ORDER. */
export function useTransferPlanCandidates(
  warehouseId: string,
  options: { loadPlanId?: string; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: loadPlanKeys.transferCandidates(warehouseId, options.loadPlanId),
    queryFn: ({ signal }) => listTransferPlanCandidates(warehouseId, options.loadPlanId, signal),
    enabled: !!warehouseId && (options.enabled ?? true),
    ...QUERY_TIMES.tracking,
  });
}

export function useActiveVehicleTypes() {
  return useQuery({
    queryKey: loadPlanKeys.vehicleTypes,
    queryFn: ({ signal }) => listActiveVehicleTypes(signal),
    ...QUERY_TIMES.master,
  });
}
