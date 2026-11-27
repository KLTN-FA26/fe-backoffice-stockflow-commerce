"use client";

import { CANCELLATION_REQUEST_LABELS } from "@/constants";
import { columnSummaryItem, columnToolbarProps } from "@/hooks/use-column-visibility";

import { ListToolbar } from "@/components/shared/ListToolbar";

import { CANCELLATION_QUEUE_COLUMNS, CANCELLATION_QUEUE_LABELS } from "./columns";
import { FILTER_LABELS, reasonLabel, STATUS_OPTIONS, statusLabel } from "./queue-columns";
import { DEFAULT_REQUEST_STATUS } from "./useCancellationFilters";

import type { ColumnVisibility } from "@/hooks/use-column-visibility";
import type { CancellationQueueColumn } from "./columns";
import type { CancellationFilters, RequestStatus } from "./useCancellationFilters";

const L = CANCELLATION_REQUEST_LABELS;

/**
 * Toolbar kiểu Vercel: ô tìm kéo dài, hàng chip (Bộ lọc trạng thái, Ẩn hiện cột, Trạng thái, Search trong cột, Cột hiển
 * thị), Đặt lại.
 */
export function CancellationRequestToolbar({
  filters,
  columns,
}: {
  filters: CancellationFilters;
  columns: ColumnVisibility<CancellationQueueColumn>;
}) {
  return (
    <ListToolbar<RequestStatus, never, CancellationQueueColumn>
      {...columnToolbarProps(columns, CANCELLATION_QUEUE_LABELS, CANCELLATION_QUEUE_COLUMNS)}
      controlsIn="summary"
      search={filters.q}
      onSearchChange={filters.setQ}
      searchPlaceholder={L.list.search}
      statusOptions={STATUS_OPTIONS}
      selectedStatuses={filters.status ? [filters.status] : []}
      // BE nhận MỘT trạng thái: tick là chọn một, tick lại = "Tất cả"; "Xoá lọc" về mặc định (đang chờ)
      onToggleStatus={(value) => filters.setStatus(filters.status === value ? "ALL" : value)}
      onClearStatuses={() => filters.setStatus(DEFAULT_REQUEST_STATUS)}
      hasStatusFilter={filters.statusChanged}
      summaryItems={[
        {
          label: L.list.statusFilter,
          value: filters.status ? statusLabel(filters.status) : L.list.statusAll,
          active: filters.statusChanged,
          onClear: () => filters.setStatus(DEFAULT_REQUEST_STATUS),
        },
        filters.columns.summaryItem(FILTER_LABELS, { crReason: reasonLabel }),
        columnSummaryItem(columns),
      ]}
      onResetAll={() => {
        filters.clear();
        columns.reset();
      }}
      resetDisabled={!filters.active && !columns.hasColumnConfig}
    />
  );
}
