"use client";

import { PAGE_SIZE, STORAGE_KEYS } from "@/constants";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { usePageConfig } from "@/hooks/use-page-config";

import { CANCELLATION_QUEUE_COLUMNS, CANCELLATION_QUEUE_LOCKED } from "./columns";

export const PAGE_SIZE_OPTIONS: number[] = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl];

interface RequestPageConfig {
  pageSize: number;
}
const DEFAULT_CONFIG: RequestPageConfig = { pageSize: PAGE_SIZE.md };

/** Bỏ page size lạ trong localStorage cũ. */
function mergeConfig(
  stored: Partial<RequestPageConfig>,
  fallback: RequestPageConfig,
): RequestPageConfig {
  return stored.pageSize && PAGE_SIZE_OPTIONS.includes(stored.pageSize)
    ? { pageSize: stored.pageSize }
    : fallback;
}

/**
 * Sở thích hiển thị của hàng đợi yêu cầu huỷ — số dòng / trang + cột đang hiện. Lưu localStorage, không lên URL
 * (state-persistence: người khác mở link không cần thấy giống mình).
 */
export function useQueuePrefs() {
  const pageConfig = usePageConfig<RequestPageConfig>(
    STORAGE_KEYS.adminCancellationRequestsConfig,
    DEFAULT_CONFIG,
    mergeConfig,
  );
  const columnState = useColumnVisibility(
    STORAGE_KEYS.adminCancellationRequestsColumns,
    CANCELLATION_QUEUE_COLUMNS,
    { locked: CANCELLATION_QUEUE_LOCKED },
  );
  return { ...pageConfig, columnState };
}
