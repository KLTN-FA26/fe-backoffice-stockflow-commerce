"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import {
  FULFILLMENT_DESIGN_REVERIFICATION_PERMISSIONS,
  FULFILLMENT_PICK_PERMISSIONS,
  FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS,
  FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS,
  UI_LABELS,
} from "@/constants";
import { canCreateTask } from "@/features/fulfillment/lifecycle";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

import { AssignDialog } from "./assign/AssignDialog";
import { CreateTaskDialog } from "./assign/CreateTaskDialog";
import { FulfillmentPermissionGate } from "./FulfillmentPermissionGate";
import { buildTaskColumns } from "./list/columns";
import { TaskListBody } from "./list/TaskListBody";
import { TaskListFilters } from "./list/TaskListFilters";
import { TaskListToolbar } from "./list/TaskListToolbar";
import { useTaskFilterLabels } from "./list/useTaskFilterLabels";
import { useTaskListState } from "./list/useTaskListState";
import { useFulfillmentActor } from "./useFulfillmentActor";

import type { FulfillmentActor } from "@/features/fulfillment/lifecycle";
import type { FulfillmentTask } from "@/features/fulfillment/types";
import type { FulfillmentScope } from "./primitives";

const { fulfillment } = UI_LABELS;

const SCOPE_COPY = {
  picking: { title: fulfillment.pickingTitle, subtitle: fulfillment.pickingSubtitle },
  packing: { title: fulfillment.packingTitle, subtitle: fulfillment.packingSubtitle },
} as const;

/**
 * BE `listTasks` quyết phạm vi theo mã quyền, theo đúng thứ tự ưu tiên này:
 * fulfillment-task-oversight:READ → mọi task; fulfillment-design-reverification:READ → task đang giữ
 * do lệch thiết kế; còn lại → task được gán cho mình.
 */
function scopeNote(actor: FulfillmentActor): string {
  if (actor.can(FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS.read)) return "mọi task";
  if (actor.can(FULFILLMENT_DESIGN_REVERIFICATION_PERMISSIONS.read)) {
    return "kiện đang bị giữ do lệch thiết kế";
  }
  return "task được gán cho bạn";
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
  const [assigning, setAssigning] = useState<FulfillmentTask | null>(null);
  const [creating, setCreating] = useState(false);
  const canCreate = scope === "picking" && canCreateTask(actor);
  const columns = buildTaskColumns({ scope, actor, onAssign: setAssigning });
  const visibleColumns = columns.filter((c) => s.config.visibleColumns.includes(c.key));

  return (
    <>
      <PageHeader
        title={SCOPE_COPY[scope].title}
        subtitle={SCOPE_COPY[scope].subtitle}
        actions={
          canCreate ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setCreating(true)}
              className="rounded-[var(--r-sm)]"
            >
              <Plus className="size-3.5" /> {fulfillment.action.create}
            </Button>
          ) : undefined
        }
      />
      {canRead && (
        <>
          <TaskListToolbar s={s} scopeNote={scopeNote(actor)} labels={labels} />
          <TaskListFilters
            s={s}
            canFilterAssignee={canFilterAssignee}
            assigneeLabel={labels.assignee}
          />
        </>
      )}
      <TaskListBody s={s} columns={visibleColumns} />
      {assigning && <AssignDialog task={assigning} onClose={() => setAssigning(null)} />}
      {creating && <CreateTaskDialog onClose={() => setCreating(false)} />}
    </>
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
