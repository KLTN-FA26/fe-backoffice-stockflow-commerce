import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { inventoryItemKeys } from "@/lib/references/inventory-item-keys";

import { getInventoryItem, listInventoryItems } from "./api";

import type { InventoryItemListParams } from "./api";

export { inventoryItemKeys };

/** `enabled = false` khi thiếu quyền đọc — không gọi để khỏi nhận 403. */
export function useInventoryItems(
  params: InventoryItemListParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: inventoryItemKeys.list(params),
    queryFn: ({ signal }) => listInventoryItems(params, signal),
    placeholderData: keepPreviousData, // không nháy trắng khi đổi bộ lọc / trang
    ...QUERY_TIMES.list,
    enabled: options?.enabled !== false,
  });
}

/** `staleTime: 0` ở màn sửa để luôn gửi lại `version` mới nhất. */
export function useInventoryItem(
  id: string | null | undefined,
  options?: { enabled?: boolean; staleTime?: number },
) {
  return useQuery({
    queryKey: inventoryItemKeys.detail(id ?? ""),
    queryFn: ({ signal }) => getInventoryItem(id ?? "", signal),
    ...QUERY_TIMES.detail,
    ...(options?.staleTime !== undefined ? { staleTime: options.staleTime } : {}),
    enabled: Boolean(id) && options?.enabled !== false,
  });
}
