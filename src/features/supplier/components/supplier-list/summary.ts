import {
  COLUMN_LABELS,
  DEFAULT_COLUMNS,
  DEFAULT_CONFIG,
  SEARCH_FIELDS,
  STATUS_LABELS,
} from "./constants";

import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { SupplierStatus } from "@/features/supplier/types";
import type { SupplierPageConfig } from "./constants";
import type { FilterFlags } from "./helpers";

interface BuildSummaryArgs {
  pageConfig: SupplierPageConfig;
  flags: FilterFlags;
  filters: { setStatus: (v: SupplierStatus[]) => void; setQ: (v: string) => void };
  updateConfig: (fn: (c: SupplierPageConfig) => SupplierPageConfig) => void;
  clearColumnSearch: () => void;
}

export function buildSummaryItems({
  pageConfig,
  flags,
  filters,
  updateConfig,
  clearColumnSearch,
}: BuildSummaryArgs): ListSummaryItem[] {
  return [
    { label: "Stats", value: pageConfig.showStats ? "Đang hiện" : "Đang ẩn" },
    {
      label: "Trạng thái",
      value:
        pageConfig.statuses
          .map((s) => STATUS_LABELS[s as keyof typeof STATUS_LABELS] ?? s)
          .join(", ") || "Tất cả",
      active: flags.hasStatusFilter,
      onClear: () => filters.setStatus([]),
    },
    {
      label: "Search chính",
      value: flags.hasGlobalSearch ? "“" + pageConfig.globalSearch.query + "”" : "Chưa dùng",
      active: flags.hasGlobalSearch,
      onClear: () => filters.setQ(""),
    },
    {
      label: "Trường search",
      value:
        pageConfig.globalSearch.fields
          .map((f) => SEARCH_FIELDS.find((o) => o.value === f)?.label ?? f)
          .join(", ") || "Chưa chọn",
      active: flags.hasFieldConfig,
      onClear: () =>
        updateConfig((c) => ({
          ...c,
          globalSearch: { ...c.globalSearch, fields: DEFAULT_CONFIG.globalSearch.fields },
        })),
    },
    {
      label: "Search trong cột",
      value: flags.activeColumnSearch.length
        ? flags.activeColumnSearch
            .map(([k, v]) => (COLUMN_LABELS[k] ?? k) + ' "' + v + '"')
            .join(", ")
        : "Chưa dùng",
      active: flags.activeColumnSearch.length > 0,
      onClear: clearColumnSearch,
    },
    {
      label: "Cột hiển thị",
      value: flags.visibleColumnCount + "/" + (DEFAULT_COLUMNS.length - 1),
      active: flags.hasColumnConfig,
      onClear: () => updateConfig((c) => ({ ...c, visibleColumns: DEFAULT_COLUMNS })),
    },
  ];
}
