"use client";

import { parseAsInteger, parseAsStringLiteral, useQueryStates } from "nuqs";

import { CYCLE_COUNT_STATUSES, CYCLE_COUNT_STORAGE_KEYS } from "@/constants/cycle-count";
import { INVENTORY_PAGE_SIZES } from "@/constants/inventory";
import { PAGE_SIZE } from "@/constants/table";

import { usePageConfig } from "@/hooks/use-page-config";

interface CycleCountListConfig {
  pageSize: number;
}

const DEFAULT_CONFIG: CycleCountListConfig = { pageSize: PAGE_SIZE.md };

// Trạng thái + trang một-based nằm trên URL (nuqs); cỡ trang là tuỳ chọn của trình duyệt (state-persistence).
const LIST_PARSERS = {
  status: parseAsStringLiteral(CYCLE_COUNT_STATUSES),
  page: parseAsInteger.withDefault(1),
};

function mergeConfig(
  stored: Partial<CycleCountListConfig>,
  fallback: CycleCountListConfig,
): CycleCountListConfig {
  const pageSize = INVENTORY_PAGE_SIZES.find((size) => size === stored.pageSize);
  return { pageSize: pageSize ?? fallback.pageSize };
}

export function useCycleCountFilters() {
  const [query, setQuery] = useQueryStates(LIST_PARSERS);
  const { config, updateConfig } = usePageConfig(
    CYCLE_COUNT_STORAGE_KEYS.list,
    DEFAULT_CONFIG,
    mergeConfig,
  );
  return {
    status: query.status,
    hasFilters: Boolean(query.status),
    page: Math.max(1, query.page),
    size: config.pageSize,
    // Đổi bộ lọc quay về trang đầu trong cùng một lần cập nhật URL.
    setStatus: (status: (typeof CYCLE_COUNT_STATUSES)[number] | null) =>
      setQuery({ status, page: null }),
    setPage: (page: number) => setQuery({ page }),
    setSize: (pageSize: number) => {
      updateConfig((current) => ({ ...current, pageSize }));
      void setQuery({ page: null });
    },
    reset: () => setQuery(null),
  };
}
