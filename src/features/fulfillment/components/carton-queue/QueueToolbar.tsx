"use client";

import { UI_LABELS } from "@/constants";
import { ListToolbar } from "@/components/shared/ListToolbar";

import { QUEUE_STATUS_VALUES } from "./constants";

import type { QueueStatus } from "./constants";
import type { CartonCheckQueueState } from "./useCartonCheckQueueState";

const L = UI_LABELS.cartonCheck;
const STATUS_OPTIONS = QUEUE_STATUS_VALUES.map((value) => ({
  value,
  label: L.statusFilter[value],
}));

/**
 * Toolbar hàng chờ kiểm thùng (Mode A, style Vercel — data-table-mode-a §2–§3): BE không có tìm kiếm nên không có ô
 * search; lọc MỘT trạng thái (BE `status`) qua công cụ Lọc trạng thái, chip ở thanh `Cấu hình`, "Đặt lại" bỏ lọc.
 * Kho là kho của tab theo kho — không có lọc kho.
 */
export function QueueToolbar({ s }: { s: CartonCheckQueueState }) {
  // BE nhận một trạng thái: chọn mục khác thay mục cũ, bấm lại mục đang chọn để bỏ ("" = không lọc)
  const toggleStatus = (value: QueueStatus) => s.setStatus(s.status === value ? "" : value);
  return (
    <ListToolbar<QueueStatus, string, string>
      statusOptions={STATUS_OPTIONS}
      selectedStatuses={s.status ? [s.status] : []}
      onToggleStatus={toggleStatus}
      onClearStatuses={s.clearFilters}
      hasStatusFilter={s.filtered}
      summaryItems={[
        {
          label: L.filters.status,
          value: s.status ? L.statusFilter[s.status] : L.filters.allWaiting,
          active: s.filtered,
          onClear: s.clearFilters,
        },
      ]}
      onResetAll={s.clearFilters}
      resetDisabled={!s.filtered}
    />
  );
}
