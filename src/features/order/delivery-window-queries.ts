/**
 * Dời cửa sổ giao — query hook của danh sách tin nhắn khách dùng làm bằng chứng (BE
 * `GET …/window-change/evidence/messages`, docs 17 BR-28, `sales-contracts:UPDATE`). Key nằm dưới `orderKeys.all`: dời
 * xong (invalidate `orderKeys.all`) hoặc khách nhắn thêm rồi mở lại hộp thoại thì tải lại.
 */

import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";

import { getWindowConsentMessages } from "./delivery-window-api";
import { orderKeys } from "./queries";

export const windowConsentKeys = {
  messages: (orderId: string, batchId: string) =>
    [...orderKeys.all, "window-consent-messages", orderId, batchId] as const,
};

/** Tin nhắn của khách mà BE nhận làm bằng chứng cho đợt này; chỉ tải khi `enabled` (đang chọn "Tin nhắn của khách"). */
export function useWindowConsentMessages(
  orderId: string,
  batchId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: windowConsentKeys.messages(orderId, batchId),
    queryFn: ({ signal }) => getWindowConsentMessages(orderId, batchId, signal),
    ...QUERY_TIMES.detail,
    // Mở hộp thoại là lấy danh sách mới nhất: khách có thể vừa nhắn đồng ý
    staleTime: 0,
    enabled: !!orderId && !!batchId && (options.enabled ?? true),
  });
}
