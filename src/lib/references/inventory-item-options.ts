/**
 * Gợi ý hồ sơ hàng tồn cho ô chọn SKU (BE PR #119 `GET /inventory/items?q=`, `InventoryItemSummary`).
 *
 * Đặt ở `lib/` để màn danh mục hàng NCC dùng mà không import `features/inventory-item`
 * (feature-architecture). Schema chỉ giữ các trường ô chọn cần — BE còn trả `storageClass`,
 * `trackingMode`, `policyConfigured`. BE không có tên sản phẩm hay cờ "được phép mua", nên
 * `SKU_NOT_PURCHASABLE` vẫn chỉ biết sau khi lưu.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { INVENTORY_ITEM_OPTIONS_PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";
import { bePageSchema } from "@/lib/api/page-schema";
import { QUERY_TIMES } from "@/lib/api/query-client";

import { inventoryItemKeys } from "./inventory-item-keys";

export const inventoryItemOptionSchema = z.object({
  id: z.string().min(1),
  sku: z.string().min(1),
  unitOfMeasure: z.string().min(1),
  // BE `non_null`: SKU chưa có mã vạch thì trường vắng khỏi JSON
  barcode: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
});

export type InventoryItemOption = z.infer<typeof inventoryItemOptionSchema>;

/** Một trang gợi ý; `hasMore` = BE còn trang sau (kết quả nhiều hơn `INVENTORY_ITEM_OPTIONS_PAGE_SIZE`). */
export interface InventoryItemOptionPage {
  items: InventoryItemOption[];
  hasMore: boolean;
}

const optionPageSchema = bePageSchema(inventoryItemOptionSchema);

export const inventoryItemOptionKeys = {
  options: (q: string) => [...inventoryItemKeys.all, "options", q] as const,
};

/** Trang đầu kết quả tìm theo SKU hoặc mã vạch (BE sắp theo SKU); `q` rỗng = mọi hồ sơ. */
export async function fetchInventoryItemOptions(
  q: string,
  signal?: AbortSignal,
): Promise<InventoryItemOptionPage> {
  const params = new URLSearchParams({
    page: "0",
    size: String(INVENTORY_ITEM_OPTIONS_PAGE_SIZE),
  });
  const term = q.trim();
  if (term) params.set("q", term);
  const { data } = await api.get<unknown>("/inventory/items", { params, signal });
  const parsed = optionPageSchema.parse(data);
  return { items: parsed.items, hasMore: parsed.hasNext };
}

/** `q` đã debounce ở component; giữ kết quả cũ khi đang gõ để danh sách không nháy rỗng. */
export function useInventoryItemOptions(q: string, enabled: boolean) {
  const term = q.trim();
  return useQuery({
    queryKey: inventoryItemOptionKeys.options(term),
    queryFn: ({ signal }) => fetchInventoryItemOptions(term, signal),
    enabled,
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.list,
  });
}
