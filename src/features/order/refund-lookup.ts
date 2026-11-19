/**
 * Số phải hoàn của một đơn — `GET /refunds/orders/{orderId}` (BE `OrderRefundResponse`, `payment-refunds:READ`).
 * Màn Duyệt tín dụng chỉ cần con số sau khi từ chối (plan WF-02 C5); màn hoàn tiền đầy đủ ở feature payment
 * (không import chéo feature — chỉ parse phần cần).
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";

const refundDueSchema = z.object({
  orderId: z.string(),
  currency: z.string(),
  /** Tổng phải hoàn (tiền đã thu của đơn bị huỷ). */
  refundable: z.number(),
  /** Còn phải hoàn sau các lần đã ghi nhận. */
  remaining: z.number(),
});

export type OrderRefundDue = z.infer<typeof refundDueSchema>;

export async function getOrderRefundDue(
  orderId: string,
  signal?: AbortSignal,
): Promise<OrderRefundDue> {
  const { data } = await api.get<unknown>(`/refunds/orders/${encodeURIComponent(orderId)}`, {
    signal,
  });
  return refundDueSchema.parse(data);
}

export function useOrderRefundDue(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["orders", "refund-due", orderId] as const,
    queryFn: ({ signal }) => getOrderRefundDue(orderId, signal),
    enabled,
  });
}
