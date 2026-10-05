import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, STORAGE_KEYS, SUPPLIER_STATUSES } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useSuppliers } from "@/features/supplier/queries";

import {
  DEFAULT_COLUMNS,
  DEFAULT_CONFIG,
  SERVER_SORT_FIELDS,
  mergeStoredConfig,
} from "./constants";

import type { SupplierDto, SupplierStatus } from "@/features/supplier/types";
import type { ServerSortField, SupplierPageConfig } from "./constants";

type SortDir = "asc" | "desc";

export type SupplierListEmptyState = "none" | "no-suppliers" | "no-results" | "invalid-page";

function isSortField(value: string): value is ServerSortField {
  return (SERVER_SORT_FIELDS as readonly string[]).includes(value);
}

/** URL `sort=name,asc` → state cho DataTable.serverSorting. */
function parseSort(raw: string): { key: ServerSortField | null; direction: SortDir } {
  const [key = "", dir] = raw.split(",");
  return { key: isSortField(key) ? key : null, direction: dir === "desc" ? "desc" : "asc" };
}

/**
 * State trang danh sách NCC — filter/search/status/sort/page trên URL (nuqs), cột + số dòng
 * trong localStorage (state-persistence.md). Phân trang/lọc/sắp xếp phía server (BE PR #36).
 */
export function useSupplierListState(canRead = true) {
  const router = useRouter();
  const filters = useUrlFilters(SUPPLIER_STATUSES);
  const { config, updateConfig } = usePageConfig<SupplierPageConfig>(
    STORAGE_KEYS.adminSuppliersConfig,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  const sort = parseSort(filters.sort);
  const query = useSuppliers(
    {
      page: Math.max(0, filters.page - 1),
      size: config.pageSize,
      search: filters.debouncedQ,
      status: filters.status,
      sort: sort.key ? `${sort.key},${sort.direction}` : undefined,
    },
    { enabled: canRead },
  );

  const hasFilters = filters.q.trim() !== "" || filters.status.length > 0;
  const page = query.data;
  const emptyState: SupplierListEmptyState = !page
    ? "none"
    : page.totalElements === 0
      ? hasFilters
        ? "no-results"
        : "no-suppliers"
      : page.items.length === 0
        ? "invalid-page"
        : "none";

  const navigateToDetail = useCallback(
    (s: SupplierDto) => router.push(ADMIN_ROUTES.suppliers.detail(s.supplierId)),
    [router],
  );

  const toggleStatus = (status: SupplierStatus) =>
    filters.setStatus(
      filters.status.includes(status)
        ? filters.status.filter((x) => x !== status)
        : [...filters.status, status],
    );

  const toggleColumn = (column: string) => {
    if (column === "actions") return;
    updateConfig((c) => {
      const next = c.visibleColumns.includes(column)
        ? c.visibleColumns.filter((x) => x !== column)
        : [...c.visibleColumns, column];
      return { ...c, visibleColumns: next.includes("actions") ? next : [...next, "actions"] };
    });
  };

  const changeSort = (key: string, direction: SortDir) => {
    if (!isSortField(key)) return;
    void filters.setSort(`${key},${direction}`);
    void filters.setPage(1);
  };

  const changePageSize = (pageSize: number) => {
    updateConfig((c) => ({ ...c, pageSize }));
    void filters.setPage(1);
  };

  const resetAll = () => {
    updateConfig(() => DEFAULT_CONFIG);
    filters.reset();
  };

  const visibleColumnCount = config.visibleColumns.filter((c) => c !== "actions").length;

  return {
    canRead,
    query,
    config,
    filters,
    sort,
    hasFilters,
    emptyState,
    visibleColumnCount,
    hasColumnConfig: visibleColumnCount !== DEFAULT_COLUMNS.length - 1,
    updateConfig,
    navigateToDetail,
    toggleStatus,
    toggleColumn,
    changeSort,
    changePageSize,
    resetAll,
  };
}

export type SupplierListState = ReturnType<typeof useSupplierListState>;
