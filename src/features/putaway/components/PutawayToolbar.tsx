"use client";

import { PUTAWAY_LABELS, UI_LABELS } from "@/constants";
import { ListToolbar } from "@/components/shared/ListToolbar";

import { LOCKED_PUTAWAY_COLUMNS, PUTAWAY_DATA_COLUMNS } from "./usePutawayColumns";
import { PutawayWarehouseSelect, warehouseLabel } from "./PutawayWarehouseSelect";

import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { WarehouseOption } from "@/lib/references/warehouse-options";
import type { PutawayColumn, PutawayColumnsState } from "./usePutawayColumns";
import type { PutawayFiltersState } from "./usePutawayFilters";

const L = PUTAWAY_LABELS;
const COLUMN_OPTIONS = PUTAWAY_DATA_COLUMNS.map((value) => ({ value, label: L.column[value] }));
const quoted = (label: string, value: string) => (value.trim() ? `${label} “${value}”` : null);

/** Chip thanh `Cấu hình` (data-table-mode-a §3): mỗi nhóm một chip, X bỏ riêng nhóm đó. */
function summaryItems(
  state: PutawayFiltersState,
  columns: PutawayColumnsState,
  warehouses: readonly WarehouseOption[],
): ListSummaryItem[] {
  const { filters, set } = state;
  const col = L.column;
  const columnSearch = [
    quoted(col.lpn, filters.lpn),
    quoted(col.sku, filters.sku),
    quoted(col.sourceLocation, filters.location),
  ].filter((part): part is string => part !== null);
  const warehouse = warehouses.find((w) => w.warehouseId === state.warehouseId);
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
      onClear: () => set({ lpn: "", sku: "", location: "" }),
    },
    {
      label: L.warehouse,
      value: warehouse ? warehouseLabel(warehouse) : (state.warehouseId ?? L.notChosen),
      active: filters.warehouse !== null,
      onClear: () => set({ warehouse: null }),
    },
    ...(filters.receipt
      ? [
          {
            label: L.receiptFilter,
            value: L.receipt,
            active: true,
            onClear: () => set({ receipt: null }),
          },
        ]
      : []),
    {
      label: L.summaryColumns,
      value: `${columns.visible.length}/${PUTAWAY_DATA_COLUMNS.length}`,
      active: columns.hasColumnConfig,
      onClear: columns.reset,
    },
  ];
}

/**
 * Toolbar danh sách cất hàng (Mode A, style Vercel): search chính (lọc client — BE không có tìm kiếm), ô chọn kho
 * cùng cỡ nút công cụ, ẩn hiện cột, thanh `Cấu hình`. Lọc theo LPN / SKU / vị trí nằm trên header cột.
 */
export function PutawayToolbar({
  state,
  columns,
  warehouses,
}: {
  state: PutawayFiltersState;
  columns: PutawayColumnsState;
  warehouses: readonly WarehouseOption[];
}) {
  return (
    <ListToolbar<string, string, PutawayColumn>
      search={state.filters.q}
      onSearchChange={(q) => state.set({ q })}
      searchPlaceholder={L.searchPlaceholder}
      columnOptions={COLUMN_OPTIONS}
      selectedColumns={columns.visible}
      defaultColumns={[...PUTAWAY_DATA_COLUMNS]}
      lockedColumns={LOCKED_PUTAWAY_COLUMNS}
      visibleColumnCount={columns.visible.length}
      onToggleColumn={columns.toggle}
      onResetColumns={columns.reset}
      hasColumnConfig={columns.hasColumnConfig}
      tools={
        <PutawayWarehouseSelect
          value={state.warehouseId}
          warehouses={warehouses}
          onChange={(warehouse) => state.set({ warehouse, receipt: null })}
        />
      }
      summaryItems={summaryItems(state, columns, warehouses)}
      onResetAll={() => {
        state.reset();
        columns.reset();
      }}
      resetDisabled={!state.hasFilters && !columns.hasColumnConfig}
    />
  );
}
