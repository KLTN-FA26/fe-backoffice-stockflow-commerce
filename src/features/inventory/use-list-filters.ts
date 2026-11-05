"use client";

import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

import { INVENTORY_PAGE_SIZES, STOCK_MOVEMENT_TYPES } from "@/constants/inventory";
import { STOCK_ADJUSTMENT_STATUSES } from "@/constants/statuses";
import { PAGE_SIZE } from "@/constants/table";

import { usePageConfig } from "@/hooks/use-page-config";

interface InventoryListConfig {
  pageSize: number;
}

const DEFAULT_CONFIG: InventoryListConfig = { pageSize: PAGE_SIZE.md };

// Shareable filters and the one-based page live in the URL (nuqs); page size is
// a per-browser preference (usePageConfig) — see state-persistence rules.
const LIST_PARSERS = {
  sku: parseAsString.withDefault(""),
  location: parseAsString.withDefault(""),
  status: parseAsStringLiteral(STOCK_ADJUSTMENT_STATUSES),
  type: parseAsStringLiteral(STOCK_MOVEMENT_TYPES),
  page: parseAsInteger.withDefault(1),
};

function mergeConfig(
  stored: Partial<InventoryListConfig>,
  fallback: InventoryListConfig,
): InventoryListConfig {
  const pageSize = INVENTORY_PAGE_SIZES.find((size) => size === stored.pageSize);
  return { pageSize: pageSize ?? fallback.pageSize };
}

export function useInventoryListFilters(storageKey: string) {
  const [query, setQuery] = useQueryStates(LIST_PARSERS);
  const { config, updateConfig } = usePageConfig(storageKey, DEFAULT_CONFIG, mergeConfig);
  const { sku, location, status, type } = query;
  const filters = { sku, location, status, type };

  return {
    filters,
    hasFilters: Boolean(sku || location || status || type),
    page: Math.max(1, query.page),
    size: config.pageSize,
    // Changing a filter returns to the first page in the same URL update.
    setFilters: (next: Partial<typeof filters>) => setQuery({ ...next, page: null }),
    setPage: (page: number) => setQuery({ page }),
    setSize: (pageSize: number) => {
      updateConfig((current) => ({ ...current, pageSize }));
      void setQuery({ page: null });
    },
    reset: () => setQuery(null),
  };
}
