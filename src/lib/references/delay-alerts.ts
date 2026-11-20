/**
 * Cảnh báo trễ của một đơn bán (kltn-docs 17 §4.12 bước 48–49; BE `DelayAlertController`, `delay-alerts:READ`):
 * `GET /delay-alerts?salesOrderId&type&open&page&size` — mặc định chỉ cảnh báo đang mở, mới nhất trước. Hệ thống tự
 * mở / đóng, không có thao tác ghi. Đặt ở `lib/` vì trang đơn bán (`features/order`) và chi tiết Đơn sản xuất
 * (`features/production-order`) cùng đọc; key dưới root `delay-alerts` nên mutation Đơn sản xuất làm mới luôn.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { DELAY_ALERT_TYPES, PAGE_SIZE, SHARED_QUERY_ROOTS } from "@/constants";
import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { bePageSchema } from "@/lib/api/page-schema";

/** BE `DelayAlert`: chủ thể là Đơn sản xuất (AT_RISK, PRODUCTION_LATE) hoặc đợt giao (PO_NEEDED, DELIVERY_LATE). */
export const delayAlertSchema = z.object({
  id: z.string(),
  type: z.enum(DELAY_ALERT_TYPES),
  open: z.boolean(),
  salesOrderId: z.string(),
  orderNumber: z.string().nullish(),
  productionOrderId: z.string().nullish(),
  productionOrderCode: z.string().nullish(),
  deliveryBatchId: z.string().nullish(),
  deliveryBatchSeq: z.number().int().nullish(),
  warehouseId: z.string().nullish(),
  openedAt: z.string(),
  closedAt: z.string().nullish(),
});

export type DelayAlert = z.infer<typeof delayAlertSchema>;

const delayAlertPageSchema = bePageSchema(delayAlertSchema);

export const delayAlertKeys = {
  all: [SHARED_QUERY_ROOTS.delayAlerts] as const,
  ofOrder: (salesOrderId: string) => [...delayAlertKeys.all, "order", salesOrderId] as const,
};

/** Cảnh báo đang mở của đơn — một đơn có ít cảnh báo (≤ 4 loại × số đợt / Đơn sản xuất), một trang là đủ. */
export async function fetchOpenDelayAlerts(
  salesOrderId: string,
  signal?: AbortSignal,
): Promise<DelayAlert[]> {
  const { data } = await api.get<unknown>("/delay-alerts", {
    params: { salesOrderId, open: true, page: 0, size: PAGE_SIZE.masterData },
    signal,
  });
  return delayAlertPageSchema.parse(data).items;
}

/**
 * `enabled=false` khi người dùng không có `delay-alerts:READ`. Điều phối sản xuất có quyền này từ BE V20261209000400 —
 * BE bỏ `DELIVERY_LATE` khỏi danh sách của họ (BR-30).
 */
export function useOpenDelayAlerts(salesOrderId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: delayAlertKeys.ofOrder(salesOrderId ?? ""),
    queryFn: ({ signal }) => fetchOpenDelayAlerts(salesOrderId ?? "", signal),
    enabled: enabled && Boolean(salesOrderId),
    ...QUERY_TIMES.list,
  });
}
