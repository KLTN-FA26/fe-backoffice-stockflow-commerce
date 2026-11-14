import { LOAD_STATUSES, PAGE_SIZE } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";

/** Giá trị lọc trạng thái trên URL: một trạng thái BE hoặc `ALL` (BE nhận MỘT trạng thái). */
export const LOAD_STATUS_FILTERS = [...LOAD_STATUSES, "ALL"] as const;
export type LoadStatusFilter = (typeof LOAD_STATUS_FILTERS)[number];

export const PAGE_SIZE_OPTIONS: number[] = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl];

/** Sở thích hiển thị (localStorage qua usePageConfig) — bộ lọc và trang nằm trên URL. */
export interface LoadPageConfig {
  pageSize: number;
}

export const DEFAULT_CONFIG: LoadPageConfig = { pageSize: PAGE_SIZE.md };

export function mergeStoredConfig(
  stored: Partial<LoadPageConfig>,
  fallback: LoadPageConfig,
): LoadPageConfig {
  return {
    pageSize:
      stored.pageSize && PAGE_SIZE_OPTIONS.includes(stored.pageSize)
        ? stored.pageSize
        : fallback.pageSize,
  };
}

export const STATUS_FILTER_OPTIONS = LOAD_STATUSES.map((value) => ({
  value,
  label: STATUS_LABEL_VI[value] ?? value,
}));
