/**
 * Danh bạ đơn vị sản xuất cho module khác (Đơn sản xuất, lịch sản xuất) — tra tên theo id và liệt kê đơn vị đang dùng
 * để chọn. Đặt ở `lib/` để không import `features/producer` (feature-architecture). Key dưới root `sales-producers`
 * nên thêm / sửa / ngừng dùng ở danh mục làm mới luôn. BE `GET /producers` (sales-producers:READ).
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { PAGE_SIZE, PRODUCER_CHANNELS, PRODUCER_STATUSES, SHARED_QUERY_ROOTS } from "@/constants";
import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";

const producerRefSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  channel: z.enum(PRODUCER_CHANNELS),
  status: z.enum(PRODUCER_STATUSES),
  standardLeadDays: z.number().int(),
});
const producerRefPageSchema = z.object({ items: z.array(producerRefSchema) });

export type ProducerRef = z.infer<typeof producerRefSchema>;

export const producerRefKeys = {
  directory: [SHARED_QUERY_ROOTS.producers, "directory"] as const,
};

/** Mọi đơn vị (mọi trạng thái) — Đơn sản xuất cũ có thể trỏ tới đơn vị đã ngừng dùng. Danh mục nhỏ, một trang. */
export async function fetchProducerDirectory(signal?: AbortSignal): Promise<ProducerRef[]> {
  const { data } = await api.get<unknown>("/producers", {
    params: { page: 0, size: PAGE_SIZE.masterData },
    signal,
  });
  return producerRefPageSchema.parse(data).items;
}

export function useProducerDirectory(enabled = true) {
  const query = useQuery({
    queryKey: producerRefKeys.directory,
    queryFn: ({ signal }) => fetchProducerDirectory(signal),
    enabled,
    ...QUERY_TIMES.master,
  });
  const items = query.data ?? [];
  // Tra theo id dùng Map (bảng gọi mỗi dòng) — không `.find()` O(n) mỗi ô
  const index = new Map(items.map((producer) => [producer.id, producer]));
  return {
    query,
    /** Chỉ đơn vị ACTIVE nhận Đơn sản xuất mới (BE 409 PRODUCER_INACTIVE). */
    active: items.filter((producer) => producer.status === "ACTIVE"),
    byId: (id: string | null | undefined) => (id ? index.get(id) : undefined),
  };
}
