import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, LOAD_COLUMNS, LOAD_STATUSES, STORAGE_KEYS } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useLoads } from "@/features/shipping/queries";

import { DEFAULT_COLUMNS, DEFAULT_CONFIG, mergeStoredConfig } from "./constants";

import type { LoadStatus } from "@/constants";
import type { LoadRow } from "@/features/shipping/types";
import type { LoadPageConfig } from "./constants";

export type LoadListEmptyState = "none" | "no-loads" | "no-results" | "invalid-page";

const ACTIONS = LOAD_COLUMNS.ACTIONS;

/** State danh sách chuyến xe — search / trạng thái / trang trên URL, cột + số dòng ở localStorage. */
export function useLoadListState(canRead = true) {
  const router = useRouter();
  const filters = useUrlFilters(LOAD_STATUSES);
  const { config, updateConfig } = usePageConfig<LoadPageConfig>(
    STORAGE_KEYS.adminShipmentsConfig,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  const query = useLoads(
    {
      page: Math.max(0, filters.page - 1),
      size: config.pageSize,
      search: filters.debouncedQ,
      status: filters.status,
    },
    { enabled: canRead },
  );

  const hasFilters = filters.q.trim() !== "" || filters.status.length > 0;
  // Empty state theo tham số của dữ liệu đang hiện (search sau debounce): xoá ô search thì trang cũ
  // (0 kết quả) còn hiện thêm ~300ms + lúc tải — không được báo "chưa có chuyến xe"
  const dataHasFilters = filters.debouncedQ.trim() !== "" || filters.status.length > 0;
  const page = query.data;
  const emptyState: LoadListEmptyState = !page
    ? "none"
    : page.totalElements === 0
      ? dataHasFilters
        ? "no-results"
        : "no-loads"
      : page.items.length === 0
        ? "invalid-page"
        : "none";

  const navigateToLoading = useCallback(
    (row: LoadRow) => router.push(ADMIN_ROUTES.shipments.loading(row.loadId)),
    [router],
  );

  const toggleStatus = (status: LoadStatus) =>
    filters.setStatus(
      filters.status.includes(status)
        ? filters.status.filter((x) => x !== status)
        : [...filters.status, status],
    );

  const toggleColumn = (column: string) => {
    if (column === ACTIONS) return;
    updateConfig((c) => {
      const next = c.visibleColumns.includes(column)
        ? c.visibleColumns.filter((x) => x !== column)
        : [...c.visibleColumns, column];
      return { ...c, visibleColumns: next.includes(ACTIONS) ? next : [...next, ACTIONS] };
    });
  };

  const visibleColumnCount = config.visibleColumns.filter((c) => c !== ACTIONS).length;

  return {
    canRead,
    query,
    config,
    filters,
    hasFilters,
    emptyState,
    visibleColumnCount,
    hasColumnConfig: visibleColumnCount !== DEFAULT_COLUMNS.length - 1,
    updateConfig,
    navigateToLoading,
    toggleStatus,
    toggleColumn,
    changePageSize: (pageSize: number) => {
      updateConfig((c) => ({ ...c, pageSize }));
      void filters.setPage(1);
    },
    clearFilters: () => filters.reset(),
    resetAll: () => {
      updateConfig(() => DEFAULT_CONFIG);
      filters.reset();
    },
  };
}

export type LoadListState = ReturnType<typeof useLoadListState>;
