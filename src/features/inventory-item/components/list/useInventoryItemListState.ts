import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, STORAGE_KEYS } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useInventoryItems } from "@/features/inventory-item/queries";

import {
  DEFAULT_COLUMNS,
  DEFAULT_CONFIG,
  FILTER_VALUES,
  LOCKED_COLUMNS,
  mergeStoredConfig,
  toListParams,
} from "./constants";

import type { InventoryItemSummary } from "@/features/inventory-item/types";
import type { FilterValue, InventoryItemPageConfig } from "./constants";

export type InventoryItemListEmptyState = "none" | "no-items" | "no-results" | "invalid-page";

const groupOf = (value: string) => value.slice(0, value.indexOf(":") + 1);

/**
 * State trang danh sách hồ sơ hàng tồn — search/filter/page trên URL (nuqs), cột + số dòng trong
 * localStorage (state-persistence.md). URL `page` 1-based, BE 0-based.
 */
export function useInventoryItemListState(canRead = true) {
  const router = useRouter();
  const filters = useUrlFilters(FILTER_VALUES);
  const { config, updateConfig } = usePageConfig<InventoryItemPageConfig>(
    STORAGE_KEYS.adminInventoryItemsConfig,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  const query = useInventoryItems(
    {
      page: Math.max(0, filters.page - 1),
      size: config.pageSize,
      q: filters.debouncedQ,
      ...toListParams(filters.status),
    },
    { enabled: canRead },
  );

  const hasFilters = filters.q.trim() !== "" || filters.status.length > 0;
  const page = query.data;
  const emptyState: InventoryItemListEmptyState = !page
    ? "none"
    : page.totalElements === 0
      ? hasFilters
        ? "no-results"
        : "no-items"
      : page.items.length === 0
        ? "invalid-page"
        : "none";

  /** Mỗi nhóm chọn tối đa 1: chọn giá trị mới thay giá trị cũ, chọn lại thì bỏ. */
  const toggleFilter = (value: FilterValue) => {
    const others = filters.status.filter((v) => groupOf(v) !== groupOf(value));
    void filters.setStatus(filters.status.includes(value) ? others : [...others, value]);
  };

  const toggleColumn = (column: string) => {
    if (LOCKED_COLUMNS.includes(column)) return;
    updateConfig((c) => ({
      ...c,
      visibleColumns: c.visibleColumns.includes(column)
        ? c.visibleColumns.filter((x) => x !== column)
        : [...c.visibleColumns, column],
    }));
  };

  const changePageSize = (pageSize: number) => {
    updateConfig((c) => ({ ...c, pageSize }));
    void filters.setPage(1);
  };

  const resetAll = () => {
    updateConfig(() => DEFAULT_CONFIG);
    filters.reset();
  };

  const navigateToDetail = (item: InventoryItemSummary) =>
    router.push(ADMIN_ROUTES.inventoryItems.detail(item.id));

  return {
    canRead,
    filters,
    config,
    updateConfig,
    query,
    hasFilters,
    emptyState,
    toggleFilter,
    toggleColumn,
    changePageSize,
    resetAll,
    navigateToDetail,
    hasColumnConfig: config.visibleColumns.length !== DEFAULT_COLUMNS.length,
  };
}

export type InventoryItemListState = ReturnType<typeof useInventoryItemListState>;
