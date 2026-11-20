/**
 * Tra cứu đơn cho module khác (kế toán lọc đợt theo đơn) — không import `features/order` (feature-architecture).
 * BE `GET /orders?search=` (`sales-orders:READ`, phạm vi ALL — kế toán có; WF-02 mục 35): `search` khớp số đơn,
 * tên / SĐT liên hệ, tên / SĐT người nhận. Kế toán không có `customer-customers:READ` nên không chọn khách trực tiếp.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { omittedOrNull } from "@/lib/validation/primitives";

const orderRefSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string(),
  /** Tên + mã khách BE kèm sẵn trên danh sách đơn (BE-15). */
  customerName: omittedOrNull(z.string()),
  customerCode: omittedOrNull(z.string()),
});
const orderRefPageSchema = z.object({ items: z.array(orderRefSchema) });

export type OrderRef = z.infer<typeof orderRefSchema>;

export const orderRefKeys = {
  all: ["references", "orders"] as const,
  search: (q: string) => [...orderRefKeys.all, "search", q] as const,
};

export function useOrderSearch(q: string, enabled = true) {
  return useQuery({
    queryKey: orderRefKeys.search(q),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ page: "0", size: "10" });
      params.set("search", q.trim());
      const { data } = await api.get<unknown>("/orders", { params, signal });
      return orderRefPageSchema.parse(data).items;
    },
    enabled: enabled && q.trim() !== "",
    ...QUERY_TIMES.list,
  });
}
