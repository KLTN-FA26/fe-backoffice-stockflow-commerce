import { PICK_STATUS_BY_API, UI_LABELS } from "@/constants";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";
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
 * Tên hiển thị của các bộ lọc đang bật (badge thanh "Cấu hình" + ô chọn người): kho và người được gán tra từ danh
 * mục đã tải cho ô chọn (React Query gộp request). Lọc người từ link mà chưa chọn kho thì chưa có danh sách người
 * → lấy tên từ task đang lọc (`assignedUserName`), không có thì nhãn chung — không hiện id người dùng.
 */
export function useTaskFilterLabels(s: TaskListState, canFilterAssignee: boolean) {
  const { data: warehouses = [] } = useWarehouseDirectory();
  const { data: people = [] } = useAssignees(s.warehouse, canFilterAssignee);
  const warehouse = warehouses.find((w) => w.warehouseId === s.warehouse);
  const person = people.find((p) => p.userId === s.assignee);
  const rowName = s.query.data?.items.find(
    (task) => task.assignedUserId === s.assignee,
  )?.assignedUserName;
  return {
    status: s.status ? pickStatusLabel(s.status) : null,
    warehouse: s.warehouse ? (warehouse?.name ?? s.warehouse) : null,
    assignee: s.assignee
      ? person
        ? assigneeName(person)
        : rowName || UI_LABELS.fulfillment.filter.filteredAssignee
      : null,
  };
}

export type TaskFilterLabels = ReturnType<typeof useTaskFilterLabels>;
