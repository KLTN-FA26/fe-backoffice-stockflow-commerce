import { PICK_STATUS_BY_API, UI_LABELS } from "@/constants";
import { statusLabelVi } from "@/lib/status-map";
import { useAssignees } from "@/features/fulfillment/queries";
import { assigneeName } from "@/features/fulfillment/reference-api";

import type { PickApiStatus } from "@/constants";
import type { TaskListState } from "./useTaskListState";

/** Nhãn tiếng Việt của một trạng thái pick BE (enum BE → tên Title Case → status-map, cùng nhãn StatusDot). */
export function pickStatusLabel(status: PickApiStatus): string {
  const name = PICK_STATUS_BY_API[status];
  return statusLabelVi(name, "pick") ?? name;
}

/**
 * Tên hiển thị của các bộ lọc đang bật (badge thanh "Cấu hình" + ô chọn người): người được gán tra từ danh sách
 * người của kho của tab (React Query gộp request); người không còn trong danh sách → tên từ task đang lọc
 * (`assignedUserName`), không có thì nhãn chung — không hiện id người dùng.
 */
export function useTaskFilterLabels(s: TaskListState, canFilterAssignee: boolean) {
  const { data: people = [] } = useAssignees(s.warehouse, canFilterAssignee);
  const person = people.find((p) => p.userId === s.assignee);
  const rowName = s.query.data?.items.find(
    (task) => task.assignedUserId === s.assignee,
  )?.assignedUserName;
  return {
    status: s.status ? pickStatusLabel(s.status) : null,
    assignee: s.assignee
      ? person
        ? assigneeName(person)
        : rowName || UI_LABELS.fulfillment.filter.filteredAssignee
      : null,
  };
}

export type TaskFilterLabels = ReturnType<typeof useTaskFilterLabels>;
