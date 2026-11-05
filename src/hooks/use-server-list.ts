"use client";

import { PAGE_SIZE } from "@/constants";

import { usePageConfig } from "./use-page-config";
import { useUrlFilters } from "./use-url-filters";

interface ServerListConfig {
  pageSize: number;
}

const DEFAULT_CONFIG: ServerListConfig = { pageSize: PAGE_SIZE.md };

function mergeConfig(stored: Partial<ServerListConfig>, fallback: ServerListConfig) {
  const pageSize =
    typeof stored.pageSize === "number" && stored.pageSize > 0
      ? stored.pageSize
      : fallback.pageSize;
  return { pageSize };
}

/**
 * State danh sách phân trang phía server cho các màn back-office mới: search / trạng thái /
 * trang / sort trên URL (nuqs, chia sẻ được link), số dòng mỗi trang trong localStorage
 * (state-persistence.md). Đổi bộ lọc hoặc số dòng → về trang đầu.
 */
export function useServerList<S extends string>(storageKey: string, statuses: readonly S[]) {
  const filters = useUrlFilters(statuses);
  const { config, updateConfig } = usePageConfig<ServerListConfig>(
    storageKey,
    DEFAULT_CONFIG,
    mergeConfig,
  );

  const toggleStatus = (status: S) =>
    filters.setStatus(
      filters.status.includes(status)
        ? filters.status.filter((value) => value !== status)
        : [...filters.status, status],
    );

  return {
    filters,
    pageSize: config.pageSize,
    /** Trang BE đánh số từ 0; URL đánh số từ 1 cho người đọc. */
    apiPage: Math.max(0, filters.page - 1),
    goToPage: (zeroBased: number) => void filters.setPage(zeroBased + 1),
    changePageSize: (pageSize: number) => {
      updateConfig((current) => ({ ...current, pageSize }));
      void filters.setPage(1);
    },
    toggleStatus,
    hasBaseFilters: filters.q.trim() !== "" || filters.status.length > 0,
  };
}
