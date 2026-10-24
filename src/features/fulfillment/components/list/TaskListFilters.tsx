"use client";

import { PICK_API_STATUSES, UI_LABELS } from "@/constants";
import { useAssignees } from "@/features/fulfillment/queries";
import { assigneeName } from "@/features/fulfillment/reference-api";
import { FormSelect } from "@/components/shared/FormSelect";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { WarehouseFilterSelect } from "../WarehouseFilterSelect";
import { pickStatusLabel } from "./useTaskFilterLabels";

import type { PickApiStatus } from "@/constants";
import type { TaskListState } from "./useTaskListState";

const F = UI_LABELS.fulfillment.filter;
const ALL = "__all__";
const TRIGGER =
  "border-border-default bg-bg-surface h-8 w-[14rem] rounded-[var(--r-sm)] text-[0.8125rem]";
const LABEL = "text-ink-secondary text-[0.8125rem]";

const isPickStatus = (value: string): value is PickApiStatus =>
  (PICK_API_STATUSES as readonly string[]).includes(value);

/**
 * Hàng lọc dưới thanh cấu hình (cùng kiểu hàng đợi đóng gói / danh sách chuyển kho): kho, một trạng thái pick
 * và — với người giám sát + gán được task — người được gán của kho đã chọn (`/fulfillment/assignees` bắt kho).
 */
export function TaskListFilters({
  s,
  canFilterAssignee,
  assigneeLabel,
}: {
  s: TaskListState;
  canFilterAssignee: boolean;
  /** Tên người đang lọc (`useTaskFilterLabels`) — cho mục chưa có trong danh sách người của kho. */
  assigneeLabel: string | null;
}) {
  // UI-only — Backend phải re-check (BE listTasks giới hạn phạm vi theo mã quyền + kho của người gọi)
  const assignees = useAssignees(s.warehouse, canFilterAssignee);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="task-filter-warehouse" className={LABEL}>
          {F.warehouse}
        </Label>
        <WarehouseFilterSelect
          id="task-filter-warehouse"
          title={F.warehouse}
          value={s.warehouse}
          onChange={s.setWarehouse}
          allLabel={F.allWarehouses}
        />
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="task-filter-status" className={LABEL}>
          {F.status}
        </Label>
        <FormSelect
          value={s.status ?? ALL}
          onValueChange={(next) => s.setStatus(isPickStatus(next) ? next : null)}
        >
          <SelectTrigger id="task-filter-status" className={TRIGGER}>
            <SelectValue />
          </SelectTrigger>
          <TitledSelectContent title={F.status}>
            <SelectItem value={ALL}>{F.allStatuses}</SelectItem>
            {PICK_API_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {pickStatusLabel(status)}
              </SelectItem>
            ))}
          </TitledSelectContent>
        </FormSelect>
      </div>
      {canFilterAssignee && (
        <div className="flex items-center gap-2">
          <Label htmlFor="task-filter-assignee" className={LABEL}>
            {F.assignee}
          </Label>
          <FormSelect
            value={s.assignee ?? ALL}
            onValueChange={(next) => s.setAssignee(next === ALL ? null : next)}
            // Đang lọc người từ URL mà chưa chọn kho → vẫn cho bỏ lọc
            disabled={!s.warehouse && !s.assignee}
          >
            <SelectTrigger id="task-filter-assignee" className={TRIGGER}>
              <SelectValue placeholder={F.pickWarehouseFirst} />
            </SelectTrigger>
            <TitledSelectContent title={F.assignee}>
              <SelectItem value={ALL}>
                {s.warehouse || s.assignee ? F.allAssignees : F.pickWarehouseFirst}
              </SelectItem>
              {s.assignee && !assignees.data?.some((user) => user.userId === s.assignee) && (
                <SelectItem value={s.assignee}>{assigneeLabel}</SelectItem>
              )}
              {(assignees.data ?? []).map((user) => (
                <SelectItem key={user.userId} value={user.userId}>
                  {assigneeName(user)}
                </SelectItem>
              ))}
            </TitledSelectContent>
          </FormSelect>
          {assignees.isError && <span className="text-danger text-xs">{F.assigneesFailed}</span>}
        </div>
      )}
    </div>
  );
}
