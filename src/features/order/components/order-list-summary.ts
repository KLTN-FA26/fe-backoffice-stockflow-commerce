import { STATUS_LABEL_VI } from "@/lib/status-map";

import {
  DEFAULT_SEARCH_FIELDS,
  DEFAULT_VISIBLE_COLUMNS,
  ORDER_COLUMN_SEARCH_LABELS,
  ORDER_SEARCH_FIELDS,
} from "../list-config";

import type { OrderColumnSearchKey } from "../list-config";
import type { ListSummaryItem } from "@/components/shared/ListToolbar";

interface SummaryArgs {
  showStats: boolean;
  status: readonly string[];
  q: string;
  searchFields: readonly string[];
  columnSearch: Partial<Record<OrderColumnSearchKey, string>>;
  visibleColumnCount: number;
  hasStatusFilter: boolean;
  hasSearchQuery: boolean;
  hasFieldConfig: boolean;
  activeColumnSearchCount: number;
  hasColumnConfig: boolean;
  onClearStatus: () => void;
  onClearQ: () => void;
  onResetFields: () => void;
  onClearColumnSearch: () => void;
  onResetColumns: () => void;
}

export function buildOrderSummaryItems({
  showStats,
  status,
  q,
  searchFields,
  columnSearch,
  visibleColumnCount,
  hasStatusFilter,
  hasSearchQuery,
  hasFieldConfig,
  activeColumnSearchCount,
  hasColumnConfig,
  onClearStatus,
  onClearQ,
  onResetFields,
  onClearColumnSearch,
  onResetColumns,
}: SummaryArgs): ListSummaryItem[] {
  const activeColumnEntries = Object.entries(columnSearch).filter(([, v]) => v?.trim());

  return [
    { label: "Stats", value: showStats ? "Đang hiện" : "Đang ẩn" },
    {
      label: "Trạng thái",
      value: hasStatusFilter
        ? status.map((s) => STATUS_LABEL_VI[s as never] ?? s).join(", ")
        : "Tất cả",
      active: hasStatusFilter,
      onClear: onClearStatus,
    },
    {
      label: "Search chính",
      value: hasSearchQuery ? `“${q}”` : "Chưa dùng",
      active: hasSearchQuery,
      onClear: onClearQ,
    },
    {
      label: "Trường search",
      value:
        searchFields
          .map((f) => ORDER_SEARCH_FIELDS.find((o) => o.value === f)?.label ?? f)
          .join(", ") || "Chưa chọn",
      active: hasFieldConfig,
      onClear: onResetFields,
    },
    {
      label: "Search trong cột",
      value: activeColumnSearchCount
        ? activeColumnEntries
            .map(([k, v]) => `${ORDER_COLUMN_SEARCH_LABELS[k as OrderColumnSearchKey]} “${v}”`)
            .join(", ")
        : "Chưa dùng",
      active: activeColumnSearchCount > 0,
      onClear: onClearColumnSearch,
    },
    {
      label: "Cột hiển thị",
      value: `${visibleColumnCount}/${DEFAULT_VISIBLE_COLUMNS.length - 1}`,
      active: hasColumnConfig,
      onClear: onResetColumns,
    },
  ];
}

export function deriveOrderListFlags(args: {
  status: readonly string[];
  q: string;
  searchFields: readonly string[];
  columnSearch: Partial<Record<OrderColumnSearchKey, string>>;
  visibleColumns: readonly string[];
  showStats: boolean;
}) {
  const hasStatusFilter = args.status.length > 0;
  const hasSearchQuery = Boolean(args.q.trim());
  const activeColumnSearch = Object.entries(args.columnSearch).filter(([, v]) => v?.trim());
  const hasFieldConfig =
    args.searchFields.length !== DEFAULT_SEARCH_FIELDS.length ||
    args.searchFields.some((f) => !DEFAULT_SEARCH_FIELDS.includes(f as never));
  const visibleColumnCount = args.visibleColumns.filter((c) => c !== "actions").length;
  const hasColumnConfig = visibleColumnCount !== DEFAULT_VISIBLE_COLUMNS.length - 1;
  const hasAnyConfig =
    hasStatusFilter ||
    hasSearchQuery ||
    hasFieldConfig ||
    activeColumnSearch.length > 0 ||
    args.showStats ||
    hasColumnConfig;

  return {
    hasStatusFilter,
    hasSearchQuery,
    activeColumnSearch,
    hasFieldConfig,
    visibleColumnCount,
    hasColumnConfig,
    hasAnyConfig,
  };
}
