import { PAGE_SIZE, WAREHOUSE_STATUSES } from "@/constants";

/** Giá trị lọc trạng thái trên URL: một trạng thái BE hoặc `ALL` (BE nhận MỘT trạng thái). */
export const WAREHOUSE_STATUS_FILTERS = [...WAREHOUSE_STATUSES, "ALL"] as const;

export const PAGE_SIZE_OPTIONS: number[] = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl];

/** Sở thích hiển thị (localStorage qua usePageConfig) — bộ lọc và trang nằm trên URL. */
export interface WarehousePageConfig {
  pageSize: number;
}

export const DEFAULT_CONFIG: WarehousePageConfig = { pageSize: PAGE_SIZE.md };

export function mergeStoredConfig(
  stored: Partial<WarehousePageConfig>,
  fallback: WarehousePageConfig,
): WarehousePageConfig {
  return {
    pageSize:
      stored.pageSize && PAGE_SIZE_OPTIONS.includes(stored.pageSize)
        ? stored.pageSize
        : fallback.pageSize,
  };
}
