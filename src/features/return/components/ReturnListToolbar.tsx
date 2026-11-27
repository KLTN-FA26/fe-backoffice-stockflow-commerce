"use client";

import { RETURN_LABELS } from "@/constants/labels-return";
import { columnSummaryItem, columnToolbarProps } from "@/hooks/use-column-visibility";

import { ListToolbar } from "@/components/shared/ListToolbar";

import { RETURN_LIST_COLUMN_LABELS, RETURN_LIST_COLUMNS } from "./return-columns";
import { CHANNEL_OPTIONS, FILTER_LABELS, labelOf, REASON_OPTIONS } from "./return-table-config";

import type { ColumnTextFilters } from "@/hooks/use-column-text-filters";
import type { ColumnVisibility } from "@/hooks/use-column-visibility";
import type { ReturnFilterKey } from "../list-filters";
import type { ReturnListColumn } from "./return-columns";
import type { ReturnFilterStatus, ReturnStatusFilter } from "./useReturnStatusFilter";

const L = RETURN_LABELS;

/**
 * Toolbar kiểu Vercel của hàng đợi trả hàng: ô tìm (BE `search`: số RMA / mã đơn) kéo dài, hàng chip (Ẩn hiện cột,
 * Search trong cột, Cột hiển thị), Đặt lại.
 */
export function ReturnListToolbar({
  search,
  onSearchChange,
  filters,
  status,
  onStatusChange,
  columns,
  onResetAll,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  filters: ColumnTextFilters<ReturnFilterKey>;
  status: ReturnStatusFilter;
  /** Đổi trạng thái → về trang đầu. */
  onStatusChange: () => void;
  columns: ColumnVisibility<ReturnListColumn>;
  onResetAll: () => void;
}) {
  return (
    <ListToolbar<ReturnFilterStatus, never, ReturnListColumn>
      {...columnToolbarProps(columns, RETURN_LIST_COLUMN_LABELS, RETURN_LIST_COLUMNS)}
      controlsIn="summary"
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={L.searchPlaceholder}
      statusOptions={status.options}
      selectedStatuses={[...status.selected]}
      onToggleStatus={(value) => {
        status.toggle(value);
        onStatusChange();
      }}
      onClearStatuses={() => {
        status.clear();
        onStatusChange();
      }}
      hasStatusFilter={status.active}
      summaryItems={[
        {
          label: L.statusFilter,
          value: status.active
            ? status.options
                .filter((option) => status.selected.includes(option.value))
                .map((option) => option.label)
                .join(", ")
            : status.openTab
              ? L.tabs.open
              : L.statusAll,
          active: status.active,
          onClear: () => {
            status.clear();
            onStatusChange();
          },
        },
        filters.summaryItem(FILTER_LABELS, {
          rtReason: labelOf(REASON_OPTIONS),
          rtChannel: labelOf(CHANNEL_OPTIONS),
        }),
        columnSummaryItem(columns),
      ]}
      onResetAll={onResetAll}
      resetDisabled={!search && !status.active && !filters.active && !columns.hasColumnConfig}
    />
  );
}
