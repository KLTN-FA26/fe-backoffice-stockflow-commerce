"use client";

import { useState } from "react";
import { cn } from "cn";
import { Plus } from "lucide-react";

import {
  FULFILLMENT_COLUMNS,
  FULFILLMENT_PICK_PERMISSIONS,
  FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS,
  FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS,
  UI_LABELS,
  WORKSPACE_PATHS,
} from "@/constants";
import { useWorkspaceHref } from "@/lib/workspace";
import { canCreateTask } from "@/features/fulfillment/lifecycle";
import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";
import { TOOLBAR_ACTION_CLASS, TOOLBAR_PRIMARY_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { AssignDialog } from "./assign/AssignDialog";
import { CreateTaskDialog } from "./assign/CreateTaskDialog";
import { FulfillmentPermissionGate } from "./FulfillmentPermissionGate";
import { buildTaskColumns } from "./list/columns";
import { TaskListBody } from "./list/TaskListBody";
import { TaskListToolbar } from "./list/TaskListToolbar";
import { useAssigneeHeaderFilter } from "./list/useAssigneeHeaderFilter";
import { useTaskFilterLabels } from "./list/useTaskFilterLabels";
import { useTaskListState } from "./list/useTaskListState";
import { useFulfillmentActor } from "./useFulfillmentActor";

import type { FulfillmentActor } from "@/features/fulfillment/lifecycle";
import type { FulfillmentTask } from "@/features/fulfillment/types";
import type { FulfillmentScope } from "./primitives";

const { fulfillment } = UI_LABELS;
const F = fulfillment.filter;

const SCOPE_COPY = {
  picking: { title: fulfillment.pickingTitle, subtitle: fulfillment.pickingSubtitle },
  packing: { title: fulfillment.packingTitle, subtitle: fulfillment.packingSubtitle },
} as const;

/**
 * BE `listTasks` quyết phạm vi theo mã quyền: fulfillment-task-oversight:READ → mọi task của kho mình phụ trách;
 * còn lại → task được gán cho mình.
 */
function scopeNote(actor: FulfillmentActor): string {
  if (actor.can(FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS.read)) return F.scopeAll;
  return F.scopeOwn;
}

function TaskListContent({ scope }: { scope: FulfillmentScope }) {
  const actor = useFulfillmentActor();
  // READ = đọc dữ liệu (tách khỏi VIEW_PAGE mở trang — BE ADR-0004): thiếu thì không gọi API
  const canRead = actor.can(FULFILLMENT_PICK_PERMISSIONS.read);
  const s = useTaskListState(scope, canRead);
  // Lọc người được gán: danh sách người lấy từ `/fulfillment/assignees` (task-assignment) và chỉ có ý nghĩa
  // khi thấy task của người khác (task-oversight). UI-only — Backend phải re-check (BE listTasks).
  const canFilterAssignee =
    actor.can(FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS.read) &&
    actor.can(FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS.update);
  const labels = useTaskFilterLabels(s, canFilterAssignee);
  const assigneeFilter = useAssigneeHeaderFilter(s, canFilterAssignee, labels.assignee);
  const [assigning, setAssigning] = useState<FulfillmentTask | null>(null);
  const [creating, setCreating] = useState(false);
  const canCreate = scope === "picking" && canCreateTask(actor);
  const href = useWorkspaceHref();
  const columns = buildTaskColumns({
    scope,
    actor,
    onAssign: setAssigning,
    detailHref: (taskId) => href(WORKSPACE_PATHS.pickingTask(taskId)),
  }).filter((c) => s.config.visibleColumns.includes(c.key));
  const createAction = canCreate ? (
    <Button
      type="button"
      size="sm"
      onClick={() => setCreating(true)}
      className={cn(TOOLBAR_ACTION_CLASS, TOOLBAR_PRIMARY_CLASS)}
    >
      <Plus className="size-3.5" /> {fulfillment.action.create}
    </Button>
  ) : undefined;

  return (
    // Trang danh sách style Vercel (`.surface-soft`): không tiêu đề hiển thị — breadcrumb là tên trang
    <div className="surface-soft">
      <h1 className="sr-only">{SCOPE_COPY[scope].title}</h1>
      {canRead ? (
        <TaskListToolbar
          s={s}
          scopeNote={scopeNote(actor)}
          labels={labels}
          showAssignee={canFilterAssignee}
          actions={createAction}
        />
      ) : (
        // Không đọc được task → không có gì để lọc, chỉ còn nút tạo (nếu có quyền)
        createAction && <div className="mb-3 flex justify-end">{createAction}</div>
      )}
      <TaskListBody
        s={s}
        columns={withHeaderFilters(columns, {
          [FULFILLMENT_COLUMNS.ASSIGNEE]: assigneeFilter,
        })}
      />
      {assigning && <AssignDialog task={assigning} onClose={() => setAssigning(null)} />}
      {creating && (
        <CreateTaskDialog warehouseId={s.warehouse} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}

/** Danh sách task ở màn Lấy hàng — cần `fulfillment-pick-lists:VIEW_PAGE`. */
export function PickingList() {
  return (
    <FulfillmentPermissionGate
      scope="picking"
      permissions={[FULFILLMENT_PICK_PERMISSIONS.viewPage]}
      variant="list"
    >
      <TaskListContent scope="picking" />
    </FulfillmentPermissionGate>
  );
}
