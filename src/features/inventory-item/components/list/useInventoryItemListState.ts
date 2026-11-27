import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";

import { ADMIN_ROUTES, STORAGE_KEYS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useInventoryItems } from "@/features/inventory-item/queries";

import {
  COLUMN_FILTER_KEYS,
  DEFAULT_COLUMNS,
  DEFAULT_CONFIG,
  LOCKED_COLUMNS,
  mergeStoredConfig,
  NO_FILTERS,
} from "./constants";
import { matchesItemColumnSearch } from "./header-filters";

import type { InventoryItemSummary } from "@/features/inventory-item/types";
import type { InventoryItemPageConfig } from "./constants";

export type InventoryItemListEmptyState = "none" | "no-items" | "no-results" | "invalid-page";

/**
 * State trang danh sách hồ sơ hàng tồn — search/page + lọc cột trên URL (nuqs), cột + số dòng trong
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
  // Lọc trên header cột SKU / Mã vạch — khoá URL riêng, tách khỏi ô tìm chính `q`
  const [skuFilter, setSkuFilter] = useQueryState(
    COLUMN_FILTER_KEYS.sku,
    parseAsString.withDefault(""),
  );
  const [barcodeFilter, setBarcodeFilter] = useQueryState(
    COLUMN_FILTER_KEYS.barcode,
    parseAsString.withDefault(""),
  );
  const debouncedSku = useDebouncedValue(skuFilter, 300).trim();
  const debouncedBarcode = useDebouncedValue(barcodeFilter, 300).trim();
  const query = useInventoryItems(
    {
      page: Math.max(0, filters.page - 1),
      size: config.pageSize,
      // BE chỉ có một `q` (SKU HOẶC mã vạch): ô tìm chính ưu tiên; không có thì gửi chữ của ô lọc cột để
      // thu hẹp, rồi lọc đúng theo cột ở `items` bên dưới.
      q: filters.debouncedQ.trim() || debouncedSku || debouncedBarcode,
    },
    { enabled: canRead },
  );

  const hasColumnFilters = skuFilter.trim() !== "" || barcodeFilter.trim() !== "";
  const hasFilters = filters.q.trim() !== "" || hasColumnFilters;
  const page = query.data;
  const items = useMemo(
    () =>
      (page?.items ?? []).filter((row) =>
        matchesItemColumnSearch(row, { sku: debouncedSku, barcode: debouncedBarcode }),
      ),
    [page, debouncedSku, debouncedBarcode],
  );
  const emptyState: InventoryItemListEmptyState = !page
    ? "none"
    : page.totalElements === 0 || (page.items.length > 0 && items.length === 0)
      ? hasFilters
        ? "no-results"
        : "no-items"
      : page.items.length === 0
        ? "invalid-page"
        : "none";

  const setColumnFilter = (set: (value: string | null) => unknown) => (value: string) => {
    void set(value || null);
    void filters.setPage(1);
  };

  /** Bỏ mọi lọc trên URL: ô tìm chính + lọc cột (filters.reset() không biết khoá lọc cột). */
  const clearFilters = () => {
    filters.reset();
    void setSkuFilter(null);
    void setBarcodeFilter(null);
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
    clearFilters();
  };

  const navigateToDetail = (item: InventoryItemSummary) =>
    router.push(ADMIN_ROUTES.inventoryItems.detail(item.id));

  return {
    canRead,
    filters,
    config,
    updateConfig,
    query,
    items,
    columnSearch: { sku: skuFilter, barcode: barcodeFilter },
    setSkuFilter: setColumnFilter(setSkuFilter),
    setBarcodeFilter: setColumnFilter(setBarcodeFilter),
    hasFilters,
    hasColumnFilters,
    clearFilters,
    emptyState,
    toggleColumn,
    changePageSize,
    resetAll,
    navigateToDetail,
    hasColumnConfig: config.visibleColumns.length !== DEFAULT_COLUMNS.length,
  };
}

export type InventoryItemListState = ReturnType<typeof useInventoryItemListState>;
