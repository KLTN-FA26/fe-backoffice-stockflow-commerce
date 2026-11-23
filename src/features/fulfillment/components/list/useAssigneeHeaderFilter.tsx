"use client";

import { UI_LABELS } from "@/constants";
import { useAssignees } from "@/features/fulfillment/queries";
import { assigneeName } from "@/features/fulfillment/reference-api";
import { HeaderOptionFilter } from "@/components/shared/ColumnHeaderFilter";

import type { ReactNode } from "react";
import type { HeaderFilterOption } from "@/components/shared/ColumnHeaderFilter";
import type { TaskListState } from "./useTaskListState";

const F = UI_LABELS.fulfillment.filter;

/**
 * Người đang lọc trên URL mà danh sách người của kho không có (đang tải, lỗi, đã nghỉ) vẫn phải có ô lọc — nếu không
 * màn bị lọc ngầm mà không có chỗ bỏ (data-table-mode-a §4.1). Nhãn là tên (`useTaskFilterLabels`), không lộ id.
 */
function withCurrent(
  options: HeaderFilterOption[],
  value: string | null,
  label: string | null,
): HeaderFilterOption[] {
  if (value === null || options.some((option) => option.value === value)) return options;
  return [...options, { value, label: label ?? F.filteredAssignee }];
}

/**
 * Lọc người được gán trên header cột "Người được gán" (BE `assignedUserId`, SCRUM-466): danh sách người của kho của tab
 * (`/fulfillment/assignees` bắt kho). Chỉ người giám sát + gán được task mới có — UI-only, Backend phải re-check
 * (BE listTasks giới hạn phạm vi theo mã quyền + kho của người gọi). Không có lựa chọn nào → không hiện nút.
 */
export function useAssigneeHeaderFilter(
  s: TaskListState,
  canFilterAssignee: boolean,
  currentLabel: string | null,
): ReactNode {
  const assignees = useAssignees(s.warehouse, canFilterAssignee);
  if (!canFilterAssignee) return null;
  const options = withCurrent(
    (assignees.data ?? []).map((user) => ({ value: user.userId, label: assigneeName(user) })),
    s.assignee,
    currentLabel,
  );
  if (options.length === 0 && !assignees.isError) return null;
  return (
    <HeaderOptionFilter
      label={F.assignee}
      value={s.assignee}
      options={options}
      onChange={s.setAssignee}
      searchPlaceholder={F.assigneeSearch}
      emptyLabel={assignees.isError ? F.assigneesFailed : F.assigneeEmpty}
    />
  );
}
