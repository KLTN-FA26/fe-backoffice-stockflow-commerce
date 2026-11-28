/**
 * Thẻ thiếu thùng — query hook + key. Key nằm dưới `orderKeys.all`: mọi thao tác đơn (và Thực hiện / gửi thẻ — xem
 * `shortage-card-mutations.ts`) invalidate `orderKeys.all` nên khối "Thiếu thùng" tự tải lại.
 */

import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/error";
import { QUERY_TIMES } from "@/lib/api/query-client";

import { getShortagePreview } from "./shortage-card-api";
import { orderKeys } from "./queries";

import type { ShortagePreview } from "./shortage-card-schemas";

export const shortageKeys = {
  ofOrder: (orderId: string) => [...orderKeys.all, "shortage", orderId] as const,
};

/** Xem trước + lịch sử thẻ của một đơn (`GET /orders/{id}/shortage`, cần `sales-orders:READ`). */
export function useShortagePreview(orderId: string, options: { enabled?: boolean } = {}) {
  return useQuery<ShortagePreview, ApiError>({
    queryKey: shortageKeys.ofOrder(orderId),
    queryFn: ({ signal }) => getShortagePreview(orderId, signal),
    ...QUERY_TIMES.detail,
    enabled: !!orderId && (options.enabled ?? true),
    // 4xx (không có quyền / ngoài phạm vi kho) và lỗi parse không retry
    retry: (count, error) => !(error instanceof ApiError) || (!error.isClientError && count < 2),
  });
}
