import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, STORAGE_KEYS } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useInventoryItems } from "@/features/inventory-item/queries";

import {
  DEFAULT_COLUMNS,
  DEFAULT_CONFIG,
  LOCKED_COLUMNS,
  mergeStoredConfig,
  NO_FILTERS,
} from "./constants";

import type { InventoryItemSummary } from "@/features/inventory-item/types";
import type { InventoryItemPageConfig } from "./constants";

export type InventoryItemListEmptyState = "none" | "no-items" | "no-results" | "invalid-page";

/**
 * State trang danh sách hồ sơ hàng tồn — search/page trên URL (nuqs), cột + số dòng trong
 * localStorage (state-persistence.md). URL `page` 1-based, BE 0-based.
 */
export function useInventoryItemListState(canRead = true) {
  const router = useRouter();
  const filters = useUrlFilters(NO_FILTERS);
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
    },
    { enabled: canRead },
  );

  const hasFilters = filters.q.trim() !== "";
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
    toggleColumn,
    changePageSize,
    resetAll,
    navigateToDetail,
    hasColumnConfig: config.visibleColumns.length !== DEFAULT_COLUMNS.length,
  };
}

export type InventoryItemListState = ReturnType<typeof useInventoryItemListState>;
