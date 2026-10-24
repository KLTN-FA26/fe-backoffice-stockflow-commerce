/**
 * Dòng lấy hàng — action-gating (feature-architecture §6), cùng cách với `lifecycle.ts`: trạng thái task,
 * MỘT mã quyền của endpoint (BE PR #148, không đọc tên vai trò) và người được gán.
 * UI-only — Backend phải re-check (FulfillmentController#confirmPick / #reportShort / #reallocateShort,
 * PickListService).
 */

import {
  FULFILLMENT_PICKING_PERMISSIONS,
  FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS,
  PICK_LINE_STATUS,
  PICK_STATUS,
} from "@/constants";

import { allowedFulfillmentActions, isAssignee } from "./lifecycle";

import type { FulfillmentAction, FulfillmentActor, FulfillmentGateState } from "./lifecycle";
import type { PickLine } from "./types";

/**
 * Người dùng xác nhận được dòng của task: task đang `Picking` (BE PICK_TASK_STATE_CONFLICT nếu không),
 * có `fulfillment-picking:UPDATE` và là người được gán (BE `requireAssigned` → 404) — quản lý kho không
 * làm hộ.
 */
export function canConfirmPickLines(task: FulfillmentGateState, actor: FulfillmentActor): boolean {
  return (
    task.pickStatus === PICK_STATUS.PICKING &&
    actor.can(FULFILLMENT_PICKING_PERMISSIONS.update) &&
    isAssignee(task, actor)
  );
}

/** Báo thiếu (X-SHORT bước 01): cùng điều kiện với xác nhận dòng — người được gán đang đứng ở bin. */
export function canReportShort(task: FulfillmentGateState, actor: FulfillmentActor): boolean {
  return canConfirmPickLines(task, actor);
}

/**
 * Phân bổ lại dòng thiếu (X-SHORT bước 04): quyết định của người phân việc — `fulfillment-task-assignment:UPDATE`
 * (điều phối, quản lý kho), không cần là người được gán. Dòng SHORT chỉ có khi task đang `Picking`.
 */
export function canReallocate(task: FulfillmentGateState, actor: FulfillmentActor): boolean {
  return (
    task.pickStatus === PICK_STATUS.PICKING &&
    actor.can(FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS.update)
  );
}

/** BE `PickList.confirm` / `reportShort`: chỉ dòng OPEN (khác → PICK_LINE_NOT_OPEN). */
export function isConfirmableLine(line: Pick<PickLine, "status">): boolean {
  return line.status === PICK_LINE_STATUS.OPEN;
}

/** BE `reallocateShort`: chỉ dòng SHORT còn giữ hàng (khác → PICK_LINE_NOT_OPEN). */
export function isReallocatableLine(line: Pick<PickLine, "status">): boolean {
  return line.status === PICK_LINE_STATUS.SHORT;
}

/**
 * Action của task kèm điều kiện dòng: "Hoàn tất lấy hàng" chỉ khi mọi dòng PICKED / CANCELLED — docs 07
 * bước 9, BE `requireAllPicked` (409 PICK_LINES_INCOMPLETE). Các action khác giữ nguyên.
 */
export function allowedTaskActions(
  task: FulfillmentGateState,
  actor: FulfillmentActor,
  gates: { linesComplete: boolean },
): readonly FulfillmentAction[] {
  return allowedFulfillmentActions(task, actor).filter(
    (action) => action.code !== "completePicking" || gates.linesComplete,
  );
}
