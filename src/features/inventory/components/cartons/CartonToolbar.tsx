"use client";

import { CARTON_LIST_LABELS as L, UI_LABELS } from "@/constants";

import { ListToolbar } from "@/components/shared/ListToolbar";

import { PACKAGE_STATUS_OPTIONS, STOCK_STATUS_OPTIONS } from "./carton-header-filters";
import { CARTON_COLUMNS, LOCKED_CARTON_COLUMNS } from "./useCartonColumns";

import type { HeaderFilterOption } from "@/components/shared/ColumnHeaderFilter";
import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { CartonColumn, CartonColumnsState } from "./useCartonColumns";
import type { CartonFiltersState } from "./useCartonFilters";

const NOT_ENTERED = UI_LABELS.common.notEntered;
const COLUMN_OPTIONS = CARTON_COLUMNS.map((value) => ({ value, label: L.column[value] }));
const quoted = (label: string, value: string) => (value.trim() ? `${label} “${value}”` : null);
const labelOf = (options: HeaderFilterOption[], value: string) =>
  options.find((option) => option.value === value)?.label ?? value;

/** Chip thanh `Cấu hình` (data-table-mode-a §3): mỗi bộ lọc một chip, X bỏ riêng chip đó. */
function summaryItems(filters: CartonFiltersState, warehouses: HeaderFilterOption[]) {
  const { state, set } = filters;
  const col = L.column;
  const columnSearch = [
    quoted(col.product, state.sku),
    quoted(col.location, state.location),
    quoted(col.lot, state.lot),
  ].filter((part): part is string => part !== null);
  /** `text` null = bộ lọc đang tắt; `idle` = chữ khi tắt. */
  const chip = (
    label: string,
    text: string | null,
    onClear: () => void,
    idle: string = L.all,
  ): ListSummaryItem => ({ label, value: text ?? idle, active: text !== null, onClear });
  return [
    {
      label: L.summarySearch,
      // q ngắn chưa được gửi lên BE (đã có Alert nhắc) → chip không coi là đang lọc
      value: filters.hasSearch ? `“${state.q.trim()}”` : NOT_ENTERED,
      active: filters.hasSearch,
      onClear: () => set({ q: "" }),
    },
    {
      label: L.summaryColumnSearch,
      value: columnSearch.length > 0 ? columnSearch.join(", ") : NOT_ENTERED,
      active: filters.hasColumnSearch,
      onClear: () => set({ sku: "", location: "", lot: "" }),
    },
    chip(col.warehouse, state.warehouse && labelOf(warehouses, state.warehouse), () =>
      set({ warehouse: null }),
    ),
    // Không lọc trạng thái thùng = mặc định của BE: chỉ thùng còn trong kho
    chip(
      col.status,
      state.status && labelOf(PACKAGE_STATUS_OPTIONS, state.status),
      () => set({ status: null }),
      L.liveOnly,
    ),
    chip(
      col.stockStatus,
      state.stockStatus && labelOf(STOCK_STATUS_OPTIONS, state.stockStatus),
      () => set({ stockStatus: null }),
    ),
  ];
}

/** Toolbar màn Thùng hàng (Mode A, style Vercel): search một phần LPN, ẩn hiện cột, thanh `Cấu hình`. */
export function CartonToolbar({
  filters,
  columns,
  warehouses,
}: {
  filters: CartonFiltersState;
  columns: CartonColumnsState;
  warehouses: HeaderFilterOption[];
}) {
  return (
    <ListToolbar<string, string, CartonColumn>
      search={filters.state.q}
      onSearchChange={(q) => filters.set({ q })}
      searchPlaceholder={L.searchPlaceholder}
      columnOptions={COLUMN_OPTIONS}
      selectedColumns={columns.visible}
      defaultColumns={columns.defaults}
      lockedColumns={LOCKED_CARTON_COLUMNS}
      visibleColumnCount={columns.visible.length}
      onToggleColumn={columns.toggle}
      onResetColumns={columns.reset}
      hasColumnConfig={columns.hasColumnConfig}
      summaryItems={[
        ...summaryItems(filters, warehouses),
        {
          label: L.summaryColumns,
          value: `${columns.visible.length}/${CARTON_COLUMNS.length}`,
          active: columns.hasColumnConfig,
          onClear: columns.reset,
        },
      ]}
      onResetAll={() => {
        filters.reset();
        columns.reset();
      }}
      resetDisabled={!filters.hasFilters && !columns.hasColumnConfig}
    />
  );
}
