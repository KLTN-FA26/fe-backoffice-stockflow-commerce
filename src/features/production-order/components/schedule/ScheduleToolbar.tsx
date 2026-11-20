"use client";

import { PRODUCTION_LABELS, UI_LABELS } from "@/constants";
import { isValidIsoDay } from "@/lib/date-range";
import { formatDate } from "@/lib/format";

import { ListToolbar } from "@/components/shared/ListToolbar";

import { LOCKED_SCHEDULE_COLUMNS, SCHEDULE_COLUMNS } from "./useScheduleColumns";

import type { HeaderFilterOption } from "@/components/shared/ColumnHeaderFilter";
import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { ScheduleColumn, ScheduleColumnsState } from "./useScheduleColumns";
import type { ScheduleFiltersState } from "./useScheduleFilters";

const L = PRODUCTION_LABELS.schedule;
const OPEN_END = "…";

const labelOf = (options: HeaderFilterOption[], value: string | null) =>
  value === null ? L.all : (options.find((o) => o.value === value)?.label ?? value);
/** Ngày sửa tay sai định dạng trên URL → hiện nguyên chữ (formatDate ném lỗi với ngày không hợp lệ). */
const dayLabel = (value: string | null) =>
  value === null ? OPEN_END : isValidIsoDay(value) ? formatDate(value) : value;
const COLUMN_OPTIONS = SCHEDULE_COLUMNS.map((value) => ({ value, label: L.column[value] }));
const quoted = (label: string, value: string) => (value.trim() ? `${label} “${value}”` : null);

/** Chip thanh `Cấu hình` (data-table-mode-a §3): mỗi nhóm lọc một chip, X bỏ riêng nhóm đó. */
function summaryItems(
  state: ScheduleFiltersState,
  producers: HeaderFilterOption[],
  warehouses: HeaderFilterOption[],
): ListSummaryItem[] {
  const { filters, set } = state;
  const columnSearch = [
    quoted(L.column.code, filters.code),
    quoted(L.column.order, filters.order),
  ].filter((part): part is string => part !== null);
  const hasRange = filters.from !== null || filters.to !== null;
  return [
    {
      label: L.summarySearch,
      value: filters.q.trim() ? `“${filters.q}”` : UI_LABELS.common.notEntered,
      active: filters.q.trim() !== "",
      onClear: () => set({ q: "" }),
    },
    {
      label: L.summaryColumnSearch,
      value: columnSearch.length > 0 ? columnSearch.join(", ") : UI_LABELS.common.notEntered,
      active: state.hasColumnSearch,
      onClear: () => set({ code: "", order: "" }),
    },
    {
      label: L.producerFilter,
      value: labelOf(producers, filters.producerId),
      active: filters.producerId !== null,
      onClear: () => set({ producerId: null }),
    },
    {
      label: L.warehouseFilter,
      value: labelOf(warehouses, filters.warehouseId),
      active: filters.warehouseId !== null,
      onClear: () => set({ warehouseId: null }),
    },
    {
      label: L.dateRange,
      value: hasRange ? `${dayLabel(filters.from)} – ${dayLabel(filters.to)}` : L.all,
      active: hasRange,
      onClear: () => set({ from: null, to: null }),
    },
    {
      label: L.alertsFilter,
      value: filters.alertsOnly ? L.alertsOnly : L.all,
      active: filters.alertsOnly,
      onClear: () => set({ alertsOnly: false }),
    },
  ];
}

function columnsItem(columns: ScheduleColumnsState): ListSummaryItem {
  return {
    label: L.summaryColumns,
    value: `${columns.visible.length}/${SCHEDULE_COLUMNS.length}`,
    active: columns.hasColumnConfig,
    onClear: columns.reset,
  };
}

/**
 * Toolbar lịch sản xuất (Mode A, style Vercel): search chính, ẩn hiện cột, thanh `Cấu hình` gom mọi bộ lọc đang bật.
 * Các bộ lọc khác nằm ở nút lọc trên header cột của hai bảng.
 */
export function ScheduleToolbar({
  state,
  columns,
  producers,
  warehouses,
}: {
  state: ScheduleFiltersState;
  /** Ẩn hiện cột của bảng Đơn sản xuất đang mở. */
  columns: ScheduleColumnsState;
  producers: HeaderFilterOption[];
  warehouses: HeaderFilterOption[];
}) {
  return (
    <ListToolbar<string, string, ScheduleColumn>
      search={state.filters.q}
      onSearchChange={(q) => state.set({ q })}
      searchPlaceholder={L.searchPlaceholder}
      columnOptions={COLUMN_OPTIONS}
      selectedColumns={columns.visible}
      defaultColumns={[...SCHEDULE_COLUMNS]}
      lockedColumns={LOCKED_SCHEDULE_COLUMNS}
      visibleColumnCount={columns.visible.length}
      onToggleColumn={columns.toggle}
      onResetColumns={columns.reset}
      hasColumnConfig={columns.hasColumnConfig}
      summaryItems={[...summaryItems(state, producers, warehouses), columnsItem(columns)]}
      onResetAll={() => {
        state.reset();
        columns.reset();
      }}
      resetDisabled={!state.hasFilters && !columns.hasColumnConfig}
    />
  );
}
