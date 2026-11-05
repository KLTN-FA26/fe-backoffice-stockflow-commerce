import { PAGE_SIZE } from "@/constants";

/** Trạng thái lọc hàng chờ — `PackStatus` BE; bỏ trống = mọi đơn đang chờ (BE `QUEUED`). */
export const QUEUE_STATUS_VALUES = ["PENDING", "PACKING", "ON_HOLD"] as const;
export type QueueStatus = (typeof QUEUE_STATUS_VALUES)[number];

/** Sở thích hiển thị (localStorage qua usePageConfig) — trang và bộ lọc nằm trên URL. */
export interface QueueConfig {
  pageSize: number;
}

export const PAGE_SIZE_OPTIONS: number[] = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl];

export const DEFAULT_QUEUE_CONFIG: QueueConfig = { pageSize: PAGE_SIZE.md };

export function mergeQueueConfig(stored: Partial<QueueConfig>, fallback: QueueConfig): QueueConfig {
  return {
    pageSize:
      stored.pageSize && PAGE_SIZE_OPTIONS.includes(stored.pageSize)
        ? stored.pageSize
        : fallback.pageSize,
  };
}
