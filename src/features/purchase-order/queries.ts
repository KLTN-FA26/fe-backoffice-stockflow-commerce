/**
 * Purchase Order — query hooks (React Query) qua các factory của `lib/api/query-factory`.
 * Mọi hook nhận `{ enabled }` để trang tắt gọi API khi thiếu quyền READ.
 */

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { PO_LIMITS } from "@/constants";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import {
  fetchPoStatusDashboard,
  getPurchaseOrder,
  listPoDeliveries,
  listPoDeliveryDecisions,
  listPurchaseOrders,
  listSupplierSpend,
} from "./api";
import { isDeliveryInFlight } from "./selectors";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { ListPoParams, PoHistoryParams, SupplierSpendParams } from "./api";
import type { DeliveryAttempt, DeliveryDecision, PoStatusCount, SupplierSpendRow } from "./schemas";
import type { PurchaseOrder } from "./types";

export const poKeys = createQueryKeys<ListPoParams>("purchase-orders");
export const poDashboardKeys = createQueryKeys<Record<string, never>>("po-status-dashboard");
export const supplierSpendKeys = createQueryKeys<SupplierSpendParams>("po-supplier-spend");
export const poDeliveryKeys = {
  all: ["po-deliveries"] as const,
  forPo: (poId: string) => ["po-deliveries", poId] as const,
  // Cùng prefix `po-deliveries` → mutation gửi / khôi phục (đã invalidate `all`) làm mới cả hai bảng.
  attempts: (poId: string, params: PoHistoryParams) =>
    ["po-deliveries", poId, "attempts", params] as const,
  decisions: (poId: string, params: PoHistoryParams) =>
    ["po-deliveries", poId, "decisions", params] as const,
};

export const usePurchaseOrders = createListQuery<PurchaseOrder, ListPoParams>(
  poKeys,
  listPurchaseOrders,
);

/** Chi tiết PO — tự tải lại khi đang gửi NCC (`isDeliveryInFlight`), dừng khi có kết quả. */
export const usePurchaseOrder = createDetailQuery<PurchaseOrder>(poKeys, getPurchaseOrder, {
  refetchInterval: (query) =>
    isDeliveryInFlight(query.state.data) ? PO_LIMITS.deliveryPollMs : false,
});

export const useSupplierSpend = createListQuery<SupplierSpendRow, SupplierSpendParams>(
  supplierSpendKeys,
  listSupplierSpend,
);

export function usePoStatusDashboard(options?: { enabled?: boolean }) {
  return useQuery<PoStatusCount[]>({
    queryKey: poDashboardKeys.list({}),
    queryFn: ({ signal }) => fetchPoStatusDashboard(signal),
    ...QUERY_TIMES.list,
    enabled: options?.enabled !== false,
  });
}

/** Các lần gửi NCC của một PO (`GET /purchase-orders/{id}/deliveries`), phân trang server. */
export function usePoDeliveries(
  poId: string,
  params: PoHistoryParams,
  /** `poll`: PO đang gửi NCC → tải lại bảng lần gửi theo chu kỳ (lần gửi được ghi bất đồng bộ). */
  options?: { enabled?: boolean; poll?: boolean },
) {
  return useQuery<PaginatedResponse<DeliveryAttempt>>({
    queryKey: poDeliveryKeys.attempts(poId, params),
    queryFn: ({ signal }) => listPoDeliveries(poId, params, signal),
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.detail,
    refetchInterval: options?.poll ? PO_LIMITS.deliveryPollMs : false,
    enabled: !!poId && options?.enabled !== false,
  });
}

/**
 * PO vừa hết "đang gửi" (QUEUED/RETRYING → kết quả cuối) → tải lại lịch sử gửi MỘT lần.
 * BE chỉ ghi dòng lần gửi sau khi worker gửi xong (SENT/FAILED), và PO + bảng tải lại theo hai
 * chu kỳ riêng: lần tải cuối của bảng có thể trước lúc có dòng → không có bước này bảng sẽ thiếu
 * dòng vừa gửi tới khi F5.
 */
export function useRefreshDeliveriesOnSettle(poId: string, inFlight: boolean) {
  const queryClient = useQueryClient();
  const wasInFlight = useRef(inFlight);
  useEffect(() => {
    if (wasInFlight.current && !inFlight) {
      void queryClient.invalidateQueries({ queryKey: poDeliveryKeys.forPo(poId) });
    }
    wasInFlight.current = inFlight;
  }, [poId, inFlight, queryClient]);
}

/** Quyết định gửi NCC của một PO (`GET /purchase-orders/{id}/delivery-decisions`). */
export function usePoDeliveryDecisions(
  poId: string,
  params: PoHistoryParams,
  options?: { enabled?: boolean },
) {
  return useQuery<PaginatedResponse<DeliveryDecision>>({
    queryKey: poDeliveryKeys.decisions(poId, params),
    queryFn: ({ signal }) => listPoDeliveryDecisions(poId, params, signal),
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.detail,
    enabled: !!poId && options?.enabled !== false,
  });
}
