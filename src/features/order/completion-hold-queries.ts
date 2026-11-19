/**
 * Giữ hoàn tất đơn — query hook + key (WF-05 GH-2). Key nằm dưới `orderKeys.all`: giữ / gỡ giữ invalidate `orderKeys.all`
 * nên cả thẻ "Giữ hoàn tất" lẫn chi tiết đơn tự tải lại.
 */

import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/error";
import { QUERY_TIMES } from "@/lib/api/query-client";

import { getCompletionHold } from "./completion-hold-api";
import { orderKeys } from "./queries";

import type { CompletionHold } from "./completion-hold-schemas";

export const completionHoldKeys = {
  all: [...orderKeys.all, "completion-hold"] as const,
  ofOrder: (orderId: string) => [...completionHoldKeys.all, orderId] as const,
};

/** Chỉ retry lỗi tạm thời (mạng / 5xx); 4xx và lỗi parse không retry. */
function retryTransient(failureCount: number, error: unknown): boolean {
  if (!(error instanceof ApiError) || error.isClientError) return false;
  return failureCount < 2;
}

/** Lần giữ hoàn tất đang mở của đơn (`null` = không bị giữ). Cần `sales-orders:READ`. */
export function useCompletionHold(orderId: string, options: { enabled?: boolean } = {}) {
  return useQuery<CompletionHold | null, ApiError>({
    queryKey: completionHoldKeys.ofOrder(orderId),
    queryFn: ({ signal }) => getCompletionHold(orderId, signal),
    ...QUERY_TIMES.detail,
    enabled: !!orderId && (options.enabled ?? true),
    retry: retryTransient,
  });
}
