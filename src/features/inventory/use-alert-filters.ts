"use client";

import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";

import { INVENTORY_PAGE_SIZES, INVENTORY_STORAGE_KEYS } from "@/constants/inventory";
import { PAGE_SIZE } from "@/constants/table";

import { usePageConfig } from "@/hooks/use-page-config";

import { parseAlertLinkFilters } from "./selectors";

interface AlertListConfig {
  pageSize: number;
}

const DEFAULT_CONFIG: AlertListConfig = { pageSize: PAGE_SIZE.md };

// Raw strings: an unknown value must be reported, not silently dropped by a literal parser.
const ALERT_PARSERS = {
  kind: parseAsString,
  warehouseId: parseAsString,
  page: parseAsInteger.withDefault(1),
};

function mergeConfig(stored: Partial<AlertListConfig>, fallback: AlertListConfig) {
  const pageSize = INVENTORY_PAGE_SIZES.find((size) => size === stored.pageSize);
  return { pageSize: pageSize ?? fallback.pageSize };
}

/** Deep-link filters and the one-based page live in the URL; page size is a browser preference. */
export function useAlertListFilters() {
  const [query, setQuery] = useQueryStates(ALERT_PARSERS);
  const { config, updateConfig } = usePageConfig(
    INVENTORY_STORAGE_KEYS.alerts,
    DEFAULT_CONFIG,
    mergeConfig,
  );
  const filters = parseAlertLinkFilters(query);
  return {
    filters,
    hasFilters: query.kind !== null || query.warehouseId !== null,
    page: Math.max(1, query.page),
    size: config.pageSize,
    setPage: (page: number) => setQuery({ page }),
    setSize: (pageSize: number) => {
      updateConfig((current) => ({ ...current, pageSize }));
      void setQuery({ page: null });
    },
    reset: () => setQuery(null),
  };
}
