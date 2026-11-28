/**
 * Gửi thẻ "Đơn thiếu N thùng" từ hội thoại (docs 16 §4.7, BR-15; BE `POST /chat/conversations/{id}/cards/shortage`). Hội
 * thoại đã biết, nên chỉ cần chọn đơn của khách: xem trước `GET /orders/{id}/shortage` (cần `sales-orders:READ`) cho biết đơn
 * có gửi được thẻ không — Sale không tự gõ số thùng hay số tiền, BE lập thẻ từ đơn. Feature đơn không import ở đây; chỉ đọc
 * hai trường của bản xem trước.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";
import { createMutation } from "@/lib/api/query-factory";
import { QUERY_ROOTS } from "@/lib/api/query-roots";

import { chatKeys } from "./queries";

const previewSchema = z.object({ sendable: z.boolean(), notSendable: z.string().nullish() });

export function useOrderShortageReadiness(orderId: string) {
  return useQuery({
    queryKey: [...chatKeys.all, "shortage-readiness", orderId] as const,
    queryFn: async ({ signal }) => {
      const { data } = await api.get<unknown>(`/orders/${encodeURIComponent(orderId)}/shortage`, {
        signal,
      });
      return previewSchema.parse(data);
    },
    enabled: !!orderId,
    retry: false,
  });
}

export const useSendShortageCardInChat = createMutation(
  async (input: {
    conversationId: string;
    orderId: string;
    note: string;
    replaceLive: boolean;
  }) => {
    await api.post<unknown>(
      `/chat/conversations/${encodeURIComponent(input.conversationId)}/cards/shortage`,
      { orderId: input.orderId, note: input.note || undefined, replaceLive: input.replaceLive },
    );
  },
  { invalidate: [chatKeys.all, QUERY_ROOTS.orders], showErrorToast: false },
);
