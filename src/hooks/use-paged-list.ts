"use client";

import { parseAsInteger, parseAsString, useQueryState } from "nuqs";

import { PAGE_SIZE } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";

interface PagedConfig {
  pageSize: number;
}

const DEFAULT_CONFIG: PagedConfig = { pageSize: PAGE_SIZE.md };

function mergeConfig(stored: Partial<PagedConfig>, fallback: PagedConfig): PagedConfig {
  return {
    pageSize:
      typeof stored.pageSize === "number" && stored.pageSize > 0
        ? stored.pageSize
        : fallback.pageSize,
  };
}

/**
 * Trang / sắp xếp trên URL (nuqs, chia sẻ được link), số dòng mỗi trang trong localStorage. BE đánh
 * số trang từ 0, URL từ 1. Sắp xếp dạng `key,asc|desc`; rỗng = mặc định của BE.
 */
export function usePagedList(storageKey: string, sortable: ReadonlySet<string>) {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [sort, setSort] = useQueryState("sort", parseAsString.withDefault(""));
  const { config, updateConfig } = usePageConfig<PagedConfig>(
    storageKey,
    DEFAULT_CONFIG,
    mergeConfig,
  );
  const [sortKey = "", sortDir] = sort.split(",");
  const sortActive = sortable.has(sortKey);
  const direction = sortDir === "asc" ? ("asc" as const) : ("desc" as const);

  return {
    apiPage: Math.max(0, page - 1),
    pageSize: config.pageSize,
    goToPage: (zeroBased: number) => void setPage(zeroBased + 1),
    resetPage: () => void setPage(1),
    changePageSize: (pageSize: number) => {
      updateConfig((current) => ({ ...current, pageSize }));
      void setPage(1);
    },
    /** `key,dir` gửi BE; `undefined` khi chưa chọn cột (BE dùng thứ tự mặc định). */
    apiSort: sortActive ? `${sortKey},${direction}` : undefined,
    sorting: {
      key: sortActive ? sortKey : null,
      direction,
      onChange: (key: string, dir: "asc" | "desc") => {
        if (!sortable.has(key)) return;
        void setSort(`${key},${dir}`);
        void setPage(1);
      },
    },
    clearSort: () => void setSort(null),
  };
}
