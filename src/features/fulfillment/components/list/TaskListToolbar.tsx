"use client";

import { PICK_API_STATUSES, UI_LABELS } from "@/constants";
import { ListToolbar } from "@/components/shared/ListToolbar";

import { COLUMN_LABELS, DATA_COLUMNS, LOCKED_COLUMNS, defaultColumns } from "./constants";
import { pickStatusLabel } from "./useTaskFilterLabels";

import type { ReactNode } from "react";
import type { PickApiStatus } from "@/constants";
import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { TaskFilterLabels } from "./useTaskFilterLabels";
import type { TaskListState } from "./useTaskListState";

const F = UI_LABELS.fulfillment.filter;
const STATUS_OPTIONS = PICK_API_STATUSES.map((value) => ({ value, label: pickStatusLabel(value) }));
const COLUMN_OPTIONS = DATA_COLUMNS.map((value) => ({
  value,
  label: COLUMN_LABELS[value] ?? value,
}));

/** Chip thanh `Cấu hình` (data-table-mode-a §3): mỗi nhóm một chip, X bỏ riêng nhóm đó. */
function summaryItems(
  s: TaskListState,
  scopeNote: string,
  labels: TaskFilterLabels,
  showAssignee: boolean,
): ListSummaryItem[] {
  return [
    // Phạm vi do BE quyết theo mã quyền — chỉ để đọc, không bỏ được
    { label: F.scope, value: scopeNote },
    {
      label: F.status,
      value: labels.status ?? F.allStatuses,
      active: s.status !== null,
      onClear: () => s.setStatus(null),
    },
    ...(showAssignee || s.assignee !== null
      ? [
          {
            label: F.assignee,
            value: labels.assignee ?? F.allAssignees,
            active: s.assignee !== null,
            onClear: () => s.setAssignee(null),
          },
        ]
      : []),
    {
      label: F.columns,
      value: `${s.visibleColumnCount}/${DATA_COLUMNS.length}`,
      active: s.hasColumnConfig,
      onClear: s.resetColumns,
    },
  ];
}

/**
 * Toolbar danh sách task (Mode A, style Vercel — data-table-mode-a §2–§3): BE không có tìm kiếm task nên không có
 * ô search; lọc một trạng thái pick (BE `status`) qua công cụ Lọc trạng thái, người được gán lọc trên header cột, ẩn
 * hiện cột, nút của trang ở `actions`. "Đặt lại" xoá cả lọc lẫn cột.
 */
export function TaskListToolbar({
  s,
  scopeNote,
  labels,
  showAssignee,
  actions,
}: {
  s: TaskListState;
  scopeNote: string;
  labels: TaskFilterLabels;
  /** Người dùng lọc được người được gán (chip luôn hiện); không thì chip chỉ hiện khi URL đang lọc. */
  showAssignee: boolean;
  actions?: ReactNode;
}) {
  // BE nhận MỘT trạng thái: chọn mục khác thay mục cũ, bấm lại mục đang chọn để bỏ
  const toggleStatus = (value: PickApiStatus) => s.setStatus(s.status === value ? null : value);
  return (
    <ListToolbar<PickApiStatus, string, string>
      statusOptions={STATUS_OPTIONS}
      selectedStatuses={s.status ? [s.status] : []}
      onToggleStatus={toggleStatus}
      onClearStatuses={() => s.setStatus(null)}
      hasStatusFilter={s.status !== null}
      columnOptions={COLUMN_OPTIONS}
      selectedColumns={s.config.visibleColumns}
      defaultColumns={defaultColumns(s.scope)}
      lockedColumns={LOCKED_COLUMNS}
      visibleColumnCount={s.visibleColumnCount}
      onToggleColumn={s.toggleColumn}
      onResetColumns={s.resetColumns}
      hasColumnConfig={s.hasColumnConfig}
      summaryItems={summaryItems(s, scopeNote, labels, showAssignee)}
      actions={actions}
      onResetAll={() => {
        s.clearFilters();
        s.resetColumns();
      }}
      resetDisabled={!s.hasFilters && !s.hasColumnConfig}
    />
  );
}
