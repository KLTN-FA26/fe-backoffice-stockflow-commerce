import { PACK_SHIPMENT_API_STATUSES, PACK_SHIPMENT_STATUS_DISPLAY, PAGE_SIZE } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";

/** Giá trị lọc trạng thái trên URL: một trạng thái BE hoặc `ALL` (BE nhận MỘT trạng thái, bỏ trống = tất cả). */
export const SHIPMENT_STATUS_FILTERS = [...PACK_SHIPMENT_API_STATUSES, "ALL"] as const;
export type ShipmentStatusFilter = (typeof SHIPMENT_STATUS_FILTERS)[number];

/** Mặc định: lô chờ xuất — việc hằng ngày của kho (docs 09 §4.1 bước 1–2). */
export const DEFAULT_STATUS_FILTER: ShipmentStatusFilter = "READY_TO_DISPATCH";

export const PAGE_SIZE_OPTIONS: number[] = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl];

/** Sở thích hiển thị (localStorage qua usePageConfig) — bộ lọc và trang nằm trên URL. */
export interface ShipmentPageConfig {
  pageSize: number;
}

export const DEFAULT_CONFIG: ShipmentPageConfig = { pageSize: PAGE_SIZE.md };

export function mergeStoredConfig(
  stored: Partial<ShipmentPageConfig>,
  fallback: ShipmentPageConfig,
): ShipmentPageConfig {
  return {
    pageSize:
      stored.pageSize && PAGE_SIZE_OPTIONS.includes(stored.pageSize)
        ? stored.pageSize
        : fallback.pageSize,
  };
}

export const STATUS_FILTER_OPTIONS = PACK_SHIPMENT_API_STATUSES.map((value) => ({
  value,
  label: STATUS_LABEL_VI[PACK_SHIPMENT_STATUS_DISPLAY[value]] ?? value,
}));
