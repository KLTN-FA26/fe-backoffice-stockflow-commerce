import { PAGE_SIZE, VEHICLE_TYPE_STATUSES } from "@/constants";

/** Giá trị lọc trạng thái trên URL: một trạng thái BE hoặc `ALL` (BE nhận MỘT trạng thái). */
export const VEHICLE_TYPE_STATUS_FILTERS = [...VEHICLE_TYPE_STATUSES, "ALL"] as const;

export const PAGE_SIZE_OPTIONS: number[] = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl];

/** Sở thích hiển thị (localStorage qua usePageConfig) — bộ lọc và trang nằm trên URL. */
export interface VehicleTypePageConfig {
  pageSize: number;
}

export const DEFAULT_CONFIG: VehicleTypePageConfig = { pageSize: PAGE_SIZE.md };

export function mergeStoredConfig(
  stored: Partial<VehicleTypePageConfig>,
  fallback: VehicleTypePageConfig,
): VehicleTypePageConfig {
  return {
    pageSize:
      stored.pageSize && PAGE_SIZE_OPTIONS.includes(stored.pageSize)
        ? stored.pageSize
        : fallback.pageSize,
  };
}
