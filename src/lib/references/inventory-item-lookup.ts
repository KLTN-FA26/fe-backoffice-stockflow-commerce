/**
 * Tra tóm tắt hồ sơ hàng tồn theo id cho module khác (vd panel biến thể của sản phẩm hiện logistics)
 * — `GET /inventory/items/{id}` (BE PR #119). Parse schema tối thiểu; khoá `inventoryItemKeys.summary`
 * (khác `detail` vì khác hình dữ liệu) nằm dưới `all` nên mutation ở màn Hồ sơ hàng tồn (invalidate
 * `all`) làm mới luôn tóm tắt này. Đặt ở `lib/` để không import `features/inventory-item`.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";

import { inventoryItemKeys } from "./inventory-item-keys";

/** BE serialise BigDecimal thành số JSON; nhận cả chuỗi số, chặn NaN. */
const beDecimal = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

const inventoryItemSummarySchema = z.object({
  id: z.string(),
  sku: z.string(),
  logistics: z.object({
    unitOfMeasure: z.string(),
    barcode: z.string().nullish(),
    weightKg: beDecimal.nullish(),
    /** BE `StorageClass` — giữ chuỗi để giá trị mới của BE không làm hỏng panel sản phẩm. */
    storageClass: z.string(),
  }),
});

export type InventoryItemSummaryRef = z.infer<typeof inventoryItemSummarySchema>;

export async function fetchInventoryItemSummary(
  id: string,
  signal?: AbortSignal,
): Promise<InventoryItemSummaryRef> {
  const { data } = await api.get<unknown>(`/inventory/items/${encodeURIComponent(id)}`, {
    signal,
  });
  return inventoryItemSummarySchema.parse(data);
}

/**
 * `enabled = false` khi thiếu quyền `inventory-inventory-items:READ` — không gọi để khỏi nhận 403;
 * id rỗng (SKU chưa có hồ sơ) cũng không gọi.
 */
export function useInventoryItemSummary(id: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: inventoryItemKeys.summary(id ?? ""),
    queryFn: ({ signal }) => fetchInventoryItemSummary(id ?? "", signal),
    ...QUERY_TIMES.detail,
    enabled: enabled && Boolean(id),
  });
}
