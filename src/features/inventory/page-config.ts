import { DEFAULT_PAGE_SIZE_OPTIONS, PAGE_SIZE } from "@/constants/table";

export const DEFAULT_INVENTORY_PAGE_CONFIG: { pageSize: number } = { pageSize: PAGE_SIZE.sm };

export function mergeInventoryPageConfig(
  stored: Partial<typeof DEFAULT_INVENTORY_PAGE_CONFIG> | null,
  fallback: typeof DEFAULT_INVENTORY_PAGE_CONFIG,
): typeof DEFAULT_INVENTORY_PAGE_CONFIG {
  const pageSize = stored?.pageSize;
  return {
    pageSize:
      typeof pageSize === "number" && DEFAULT_PAGE_SIZE_OPTIONS.includes(pageSize)
        ? pageSize
        : fallback.pageSize,
  };
}
