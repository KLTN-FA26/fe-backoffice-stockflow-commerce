"use client";

import { UI_LABELS } from "@/constants";
import { ListToolbar } from "@/components/shared/ListToolbar";

import type { ReactNode } from "react";
import type { TaxonomyListState, TaxonomyStatusFilter } from "./useTaxonomyListState";

const L = UI_LABELS.taxonomy;
const STATUS_LABEL: Record<TaxonomyStatusFilter, string> = {
  active: L.active,
  inactive: L.inactive,
};
const STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as TaxonomyStatusFilter[]).map((value) => ({
  value,
  label: STATUS_LABEL[value],
}));

/**
 * Toolbar data-table Mode A cho hai tab: tìm theo mã / tên, lọc trạng thái (BE nhận MỘT `active`
 * nên là chọn một), ẩn hiện cột, thanh cấu hình.
 */
export function TaxonomyToolbar({
  s,
  searchPlaceholder,
  columnLabels,
  lockedColumn,
  tools,
}: {
  s: TaxonomyListState;
  searchPlaceholder: string;
  columnLabels: Record<string, string>;
  lockedColumn: string;
  /** Công cụ riêng của tab (mở / thu gọn cây danh mục). */
  tools?: ReactNode;
}) {
  const allColumns = Object.keys(columnLabels);
  return (
    <ListToolbar<TaxonomyStatusFilter, string, string>
      search={s.q}
      onSearchChange={s.setQ}
      searchPlaceholder={searchPlaceholder}
      statusOptions={STATUS_OPTIONS}
      selectedStatuses={s.status ? [s.status] : []}
      onToggleStatus={(value) => s.setStatus(s.status === value ? null : value)}
      onClearStatuses={() => s.setStatus(null)}
      hasStatusFilter={Boolean(s.status)}
      columnOptions={allColumns.map((value) => ({ value, label: columnLabels[value] ?? value }))}
      selectedColumns={s.config.visibleColumns}
      defaultColumns={allColumns}
      lockedColumns={[lockedColumn]}
      visibleColumnCount={s.config.visibleColumns.length}
      onToggleColumn={s.toggleColumn}
      onResetColumns={s.resetColumns}
      hasColumnConfig={s.hasColumnConfig}
      tools={tools}
      summaryItems={[
        {
          label: "Search chính",
          value: s.q || "—",
          active: Boolean(s.q),
          onClear: () => s.setQ(""),
        },
        {
          label: L.field.active,
          value: s.status ? STATUS_LABEL[s.status] : L.allStatuses,
          active: Boolean(s.status),
          onClear: () => s.setStatus(null),
        },
        {
          label: "Cột hiển thị",
          value: `${s.config.visibleColumns.length}/${allColumns.length}`,
          active: s.hasColumnConfig,
          onClear: s.resetColumns,
        },
      ]}
      onResetAll={() => {
        s.resetFilters();
        s.resetColumns();
      }}
      resetDisabled={!s.filtered && !s.hasColumnConfig}
    />
  );
}
