/** Ước tính xếp xe — query hooks + mutation (React Query). */

import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/error";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { createMutation } from "@/lib/api/query-factory";

import {
  createLoadEstimate,
  getCurrentLoadEstimate,
  listEstimateVehicleTypes,
} from "./estimate-api";

import type { CreateEstimateInput, EstimateVehicleType, LoadEstimate } from "./estimate-types";

export const loadEstimateKeys = {
  all: ["fulfillment-load-estimates"] as const,
  current: (orderId: string) => [...loadEstimateKeys.all, "current", orderId] as const,
  /**
   * Ô chọn loại xe dùng chung root `fulfillment-vehicle-types` với danh mục loại xe (feature `vehicle-type`, không
   * import chéo): thêm / sửa / ngừng dùng một loại xe làm mới luôn ô chọn này.
   */
  vehicleTypes: () => ["fulfillment-vehicle-types", "estimate-options"] as const,
};

/** Chỉ retry lỗi tạm thời (mạng / 5xx), tối đa 2 lần — 4xx (kể cả 403 thiếu quyền) lặp lại y hệt. */
function retryTransient(failureCount: number, error: unknown): boolean {
  if (!(error instanceof ApiError) || error.isClientError) return false;
  return failureCount < 2;
}

/** Ước tính hiện hành của đơn (null = chưa có). Cần `fulfillment-load-estimates:READ` — `enabled` do người gọi quyết. */
export function useCurrentEstimate(orderId: string, enabled: boolean) {
  return useQuery<LoadEstimate | null, ApiError>({
    queryKey: loadEstimateKeys.current(orderId),
    queryFn: ({ signal }) => getCurrentLoadEstimate(orderId, signal),
    ...QUERY_TIMES.detail,
    enabled,
    retry: retryTransient,
  });
}

/** Loại xe đang dùng cho ô chọn; `enabled` để chỉ gọi khi ngăn kéo mở và người dùng được ước tính. */
export function useEstimateVehicleTypes(enabled: boolean) {
  return useQuery<EstimateVehicleType[], ApiError>({
    queryKey: loadEstimateKeys.vehicleTypes(),
    queryFn: ({ signal }) => listEstimateVehicleTypes(signal),
    ...QUERY_TIMES.master,
    enabled,
    retry: retryTransient,
  });
}

/**
 * Ước tính xếp xe. Làm mới ước tính hiện hành của đơn (bản cũ thành SUPERSEDED). `showErrorToast: false`: ngăn kéo
 * map lỗi (422 thiếu dữ liệu, 409 loại xe ngừng dùng…) ngay tại chỗ bằng `estimateErrorMessage`.
 */
export const useCreateLoadEstimate = createMutation<CreateEstimateInput, LoadEstimate>(
  createLoadEstimate,
  { invalidate: [loadEstimateKeys.all], showErrorToast: false },
);
