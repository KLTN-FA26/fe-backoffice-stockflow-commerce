import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { SHARED_QUERY_ROOTS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getDispatch, getProductionOrder, getSalesOrderBatches, listProductionOrders } from "./api";
import { getProductionSchedule } from "./schedule-api";

import type { ListProductionOrderParams } from "./api";
import type { ProductionScheduleParams } from "./schedule-schemas";
import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { ProductionOrder } from "./types";

/** Khoá gốc `production-orders` (= mã resource BE). Gửi đi / mẫu / nhập kho đổi chi tiết lẫn danh sách qua `all`. */
const base = createQueryKeys<ListProductionOrderParams>("production-orders");

export const productionOrderKeys = {
  ...base,
  dispatch: (id: string, page: number) => [...base.detail(id), "dispatch", page] as const,
  /** Số đơn bán + cửa sổ giao — dưới root đơn bán: dời cửa sổ giao (feature order) làm mới luôn. */
  salesOrderBatches: (salesOrderId: string) =>
    [SHARED_QUERY_ROOTS.salesOrders, "production-batches", salesOrderId] as const,
};

export const scheduleKeys = {
  all: [SHARED_QUERY_ROOTS.productionSchedule] as const,
  view: (params: ProductionScheduleParams) => [...scheduleKeys.all, params] as const,
};

/** 4xx (thiếu quyền, không tìm thấy) không thử lại — QueryClient mặc định đã vậy, giữ tường minh cho query phụ. */
const noRetryOn4xx = (failureCount: number, error: unknown) =>
  !(error instanceof ApiError && error.status < 500) && failureCount < 2;

/**
 * Danh sách Đơn sản xuất, tuỳ chọn `select` (vd lọc trong trang). Key dưới `production-orders` → mutation làm mới.
 */
export function useProductionOrderPage(
  params: ListProductionOrderParams,
  options: {
    enabled: boolean;
    select?: (page: PaginatedResponse<ProductionOrder>) => PaginatedResponse<ProductionOrder>;
  },
) {
  return useQuery({
    queryKey: productionOrderKeys.list(params),
    queryFn: ({ signal }) => listProductionOrders(params, signal),
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.list,
    ...options,
  });
}

export const useProductionOrder = createDetailQuery<ProductionOrder>(base, getProductionOrder);

export function useProductionOrderDispatch(id: string, page: number, enabled: boolean) {
  return useQuery({
    queryKey: productionOrderKeys.dispatch(id, page),
    queryFn: ({ signal }) => getDispatch(id, page, signal),
    enabled,
    retry: noRetryOn4xx,
    ...QUERY_TIMES.list,
  });
}

/** Số đơn bán + đợt giao để hiện trên chi tiết. Thiếu quyền → tắt, giao diện hiện mã rút gọn. */
export function useSalesOrderBatches(salesOrderId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: productionOrderKeys.salesOrderBatches(salesOrderId ?? ""),
    queryFn: ({ signal }) => getSalesOrderBatches(salesOrderId ?? "", signal),
    enabled: enabled && Boolean(salesOrderId),
    retry: noRetryOn4xx,
    ...QUERY_TIMES.detail,
  });
}

export function useProductionSchedule(params: ProductionScheduleParams, enabled = true) {
  return useQuery({
    queryKey: scheduleKeys.view(params),
    queryFn: ({ signal }) => getProductionSchedule(params, signal),
    enabled,
    ...QUERY_TIMES.list,
  });
}
