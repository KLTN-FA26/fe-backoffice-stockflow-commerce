"use client";

import { UI_LABELS, WAREHOUSE_LOCATION_LABELS as L } from "@/constants";

import { ListToolbar } from "@/components/shared/ListToolbar";

import { LOCKED_LOCATION_COLUMNS } from "./useLocationColumns";

import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { LocationFilterOptions } from "./location-header-filters";
import type { LocationColumn, LocationColumnsState } from "./useLocationColumns";
import type { LocationFiltersState } from "./useLocationFilters";

const NOT_ENTERED = UI_LABELS.common.notEntered;
const quoted = (label: string, value: string) => (value.trim() ? `${label} “${value}”` : null);
const labelOf = (options: LocationFilterOptions[keyof LocationFilterOptions], value: string) =>
  options.find((option) => option.value === value)?.label ?? value;

/** Chip thanh `Cấu hình` (data-table-mode-a §3): mỗi bộ lọc đang bật một chip, X bỏ riêng chip đó. */
function summaryItems(state: LocationFiltersState, options: LocationFilterOptions) {
  const { filters, set } = state;
  const col = L.column;
  const columnSearch = [quoted(col.code, filters.code), quoted(col.skus, filters.sku)].filter(
    (part): part is string => part !== null,
  );
  /** `text` null = bộ lọc đang tắt. */
  const chip = (label: string, text: string | null, onClear: () => void): ListSummaryItem => ({
    label,
    value: text ?? L.all,
    active: text !== null,
    onClear,
  });
  return [
    {
      label: L.summarySearch,
      value: filters.q.trim() ? `“${filters.q}”` : NOT_ENTERED,
      active: filters.q.trim() !== "",
      onClear: () => set({ q: "" }),
    },
    {
      label: L.summaryColumnSearch,
      value: columnSearch.length > 0 ? columnSearch.join(", ") : NOT_ENTERED,
      active: state.hasColumnSearch,
      onClear: () => set({ code: "", sku: "" }),
    },
    chip(col.kind, filters.kind && L.kind[filters.kind], () => set({ kind: null })),
    chip(col.zone, filters.zone && labelOf(options.zones, filters.zone), () => set({ zone: null })),
    chip(col.shelf, filters.shelf, () => set({ shelf: null })),
    chip(col.status, filters.status && labelOf(options.statuses, filters.status), () =>
      set({ status: null }),
    ),
    chip(col.onHand, filters.stock && L.stockFilter[filters.stock], () => set({ stock: null })),
  ];
}

/**
 * Toolbar danh sách vị trí (Mode A, style Vercel): search chính (mã vị trí hoặc SKU), ẩn hiện cột, thanh `Cấu hình`.
 * Các bộ lọc khác nằm trên header cột. `Đặt lại` xoá cả lọc lẫn cột.
 */
export function LocationToolbar({
  state,
  columns,
  options,
}: {
  state: LocationFiltersState;
  columns: LocationColumnsState;
  options: LocationFilterOptions;
}) {
  const columnOptions = columns.available.map((value) => ({ value, label: L.column[value] }));
  return (
    <ListToolbar<string, string, LocationColumn>
      search={state.filters.q}
      onSearchChange={(q) => state.set({ q })}
      searchPlaceholder={L.searchPlaceholder}
      columnOptions={columnOptions}
      selectedColumns={columns.visible}
      defaultColumns={[...columns.available]}
      lockedColumns={LOCKED_LOCATION_COLUMNS}
      visibleColumnCount={columns.visible.length}
      onToggleColumn={columns.toggle}
      onResetColumns={columns.reset}
      hasColumnConfig={columns.hasColumnConfig}
      summaryItems={[
        ...summaryItems(state, options),
        {
          label: L.summaryColumns,
          value: `${columns.visible.length}/${columns.available.length}`,
          active: columns.hasColumnConfig,
          onClear: columns.reset,
        },
      ]}
      onResetAll={() => {
        state.reset();
        columns.reset();
      }}
      resetDisabled={!state.hasFilters && !columns.hasColumnConfig}
    />
  );
}
