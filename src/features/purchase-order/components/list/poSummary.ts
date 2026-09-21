"use client";

import {
  COLUMN_SEARCH_LABELS,
  DEFAULT_CONFIG,
  DEFAULT_VISIBLE_COLUMNS,
  STATUS_OPTIONS,
} from "./config";
import type { PoColumnSearchKey, PurchaseOrdersPageConfig } from "./config";
import type { ListSummaryItem } from "@/components/shared/ListToolbar";

export function buildPoSummaryItems(
  pageConfig: PurchaseOrdersPageConfig,
  searchFields: readonly { value: string; label: string }[],
  hasStatusFilter: boolean,
  hasGlobalSearch: boolean,
  hasFieldConfig: boolean,
  activeColumnSearch: [string, string][],
  visibleColumnCount: number,
  hasColumnConfig: boolean,
  onClearStatus: () => void,
  onClearQ: () => void,
  onClearFields: () => void,
  onClearColumnSearch: () => void,
  onClearColumns: () => void,
): ListSummaryItem[] {
  return [
    { label: "Stats", value: pageConfig.showStats ? "Đang hiện" : "Đang ẩn" },
    {
      label: "Trạng thái",
      value: pageConfig.statuses
        .map((s) => STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s)
        .join(", "),
      active: hasStatusFilter,
      onClear: onClearStatus,
    },
    {
      label: "Search chính",
      value: hasGlobalSearch ? `“${pageConfig.globalSearch.query}”` : "Chưa dùng",
      active: hasGlobalSearch,
      onClear: onClearQ,
    },
    {
      label: "Trường search",
      value:
        pageConfig.globalSearch.fields
          .map((f) => searchFields.find((o) => o.value === f)?.label ?? f)
          .join(", ") || "Chưa chọn",
      active: hasFieldConfig,
      onClear: onClearFields,
    },
    {
      label: "Search trong cột",
      value: activeColumnSearch.length
        ? activeColumnSearch
            .map(([k, v]) => `${COLUMN_SEARCH_LABELS[k as PoColumnSearchKey]} “${v}”`)
            .join(", ")
        : "Chưa dùng",
      active: activeColumnSearch.length > 0,
      onClear: onClearColumnSearch,
    },
    {
      label: "Cột hiển thị",
      value: `${visibleColumnCount}/${DEFAULT_VISIBLE_COLUMNS.length - 1}`,
      active: hasColumnConfig,
      onClear: onClearColumns,
    },
  ];
}

export function poListFlags(pageConfig: PurchaseOrdersPageConfig) {
  const hasStatusFilter = !pageConfig.statuses.includes("all");
  const hasGlobalSearch = Boolean(pageConfig.globalSearch.query.trim());
  const activeColumnSearch = Object.entries(pageConfig.columnSearch).filter(([, v]) =>
    (v as string)?.trim(),
  ) as [string, string][];
  const hasFieldConfig =
    pageConfig.globalSearch.fields.length !== DEFAULT_CONFIG.globalSearch.fields.length ||
    pageConfig.globalSearch.fields.some(
      (f) => !DEFAULT_CONFIG.globalSearch.fields.includes(f as never),
    );
  const visibleColumnCount = pageConfig.visibleColumns.filter((c) => c !== "actions").length;
  const hasColumnConfig = visibleColumnCount !== DEFAULT_VISIBLE_COLUMNS.length - 1;
  const hasAnyConfig =
    hasStatusFilter ||
    hasGlobalSearch ||
    hasFieldConfig ||
    activeColumnSearch.length > 0 ||
    pageConfig.showStats ||
    hasColumnConfig;
  return {
    hasStatusFilter,
    hasGlobalSearch,
    activeColumnSearch,
    hasFieldConfig,
    visibleColumnCount,
    hasColumnConfig,
    hasAnyConfig,
  };
}
