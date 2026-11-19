/**
 * Dòng lấy hàng — action-gating (feature-architecture §6), cùng cách với `lifecycle.ts`: trạng thái task,
 * MỘT mã quyền của endpoint (BE PR #148, không đọc tên vai trò) và người được gán.
 * UI-only — Backend phải re-check (FulfillmentController#confirmPick / #reportShort / #reallocateShort,
 * PickListService).
 */

import {
  FULFILLMENT_PICKING_PERMISSIONS,
  FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS,
  FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS,
  PACK_STATUS,
  PICK_LINE_STATUS,
  PICK_STATUS,
} from "@/constants";

import { allowedFulfillmentActions, canWorkOnTask } from "./lifecycle";

import type { FulfillmentAction, FulfillmentActor, FulfillmentGateState } from "./lifecycle";
import type { PickLine } from "./types";

/**
 * Người dùng xác nhận được dòng của task: task đang `Picking` (BE PICK_TASK_STATE_CONFLICT nếu không),
 * có `fulfillment-picking:UPDATE` và là người được gán, hoặc người có `fulfillment-task-assignment:UPDATE`
 * làm thay khi task đã có người gán (BE `TaskAccess.requireWorker`, docs 07 BR-08 / WF4-QLK-TAKEOVER).
 */
export function canConfirmPickLines(task: FulfillmentGateState, actor: FulfillmentActor): boolean {
  return (
    task.pickStatus === PICK_STATUS.PICKING &&
    actor.can(FULFILLMENT_PICKING_PERMISSIONS.update) &&
    canWorkOnTask(task, actor)
  );
}

/** Báo thiếu (X-SHORT bước 01): cùng điều kiện với xác nhận dòng — người được gán (hoặc quản lý kho làm thay) đang đứng ở bin. */
export function canReportShort(task: FulfillmentGateState, actor: FulfillmentActor): boolean {
  return canConfirmPickLines(task, actor);
}

/**
 * Báo thiếu thùng đã về khu chờ xuất (dòng `Staged`): BE `PickList.reportShort` nhận dòng STAGED khi task đang `Picking`
 * HOẶC `Staged` (docs 20 §4.9 bước 4 — thùng ở khu chờ không còn thấy / hư hỏng, xử lý như báo thiếu). Cùng điều kiện
 * người làm với báo thiếu thường: người được gán, hoặc quản lý kho làm thay. UI-only — Backend phải re-check.
 */
export function canReportStagedShort(task: FulfillmentGateState, actor: FulfillmentActor): boolean {
  return (
    (task.pickStatus === PICK_STATUS.PICKING || task.pickStatus === PICK_STATUS.STAGED) &&
    actor.can(FULFILLMENT_PICKING_PERMISSIONS.update) &&
    canWorkOnTask(task, actor)
  );
}

/**
 * Phân bổ lại dòng thiếu (X-SHORT bước 04): quyết định của người phân việc — `fulfillment-task-assignment:UPDATE`
 * (quản lý kho, docs 07 §4.4 bước 10), không cần là người được gán. Dòng SHORT có khi task đang `Picking`, hoặc `Staged`
 * khi thùng ở khu chờ xuất bị báo / kiểm kê thấy thiếu (BE `reallocateShort` không đòi trạng thái task; thùng mới được
 * lấy về khu chờ xuất và task trở lại `Picking`).
 */
export function canReallocate(task: FulfillmentGateState, actor: FulfillmentActor): boolean {
  return (
    (task.pickStatus === PICK_STATUS.PICKING || task.pickStatus === PICK_STATUS.STAGED) &&
    actor.can(FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS.update)
  );
}

/**
 * Bù thùng đã bị trạm kiểm thùng loại vì hư hỏng (docs 08 §4.2 bước 4 → 07 §4.4 bước 10): cùng endpoint phân bổ lại và
 * cùng mã quyền (`fulfillment-task-assignment:UPDATE`), nhưng KHÔNG đòi task đang `Picking` — BE
 * `PickListService#replaceRemoved` / `requireOpenForMore` nhận mọi task chưa huỷ mà phiên kiểm thùng còn Pending / In
 * Progress (task Picked / Staged đang kiểm thùng cũng được). UI-only — Backend phải re-check (kể cả trạng thái đơn).
 */
export function canReplaceRemovedCarton(
  task: FulfillmentGateState,
  actor: FulfillmentActor,
): boolean {
  return (
    task.pickStatus !== PICK_STATUS.CANCELLED &&
    (task.packStatus === PACK_STATUS.PENDING || task.packStatus === PACK_STATUS.IN_PROGRESS) &&
    actor.can(FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS.update)
  );
}

/**
 * Dòng có thùng đã loại vì hư hỏng — hoặc theo lô giao QLK huỷ trước khi bàn giao (RTM-RTDCANCEL, `SHIPMENT_CANCELLED`:
 * thùng tốt đã vào hàng chờ cất lại) — mà đơn còn thiếu nó (BE `PickLineResponse.removalReason` / `replacementPending`):
 * dòng vẫn PICKED (hoặc PUT_BACK khi thùng đã cất), thùng REMOVED. BE báo `replacementPending=false` khi đã bù rồi.
 */
const REPLACEABLE_REMOVALS: readonly string[] = ["DAMAGED", "SHIPMENT_CANCELLED"];

export function isReplaceableRemovedLine(
  line: Pick<PickLine, "status" | "removalReason" | "replacementPending">,
): boolean {
  return (
    (line.status === PICK_LINE_STATUS.PICKED || line.status === PICK_LINE_STATUS.PUT_BACK) &&
    !!line.removalReason &&
    REPLACEABLE_REMOVALS.includes(line.removalReason) &&
    line.replacementPending === true
  );
}

/** Nút "Phân bổ lại" / "Bù thùng" của một dòng: dòng SHORT (task đang lấy) hoặc thùng hư đã loại chưa được bù. */
export function canReallocateLine(
  task: FulfillmentGateState,
  actor: FulfillmentActor,
  line: Pick<PickLine, "status" | "removalReason" | "replacementPending">,
): boolean {
  return (
    (isReallocatableLine(line) && canReallocate(task, actor)) ||
    (isReplaceableRemovedLine(line) && canReplaceRemovedCarton(task, actor))
  );
}

/**
 * Nút cuối dòng của bảng dòng lấy hàng: phân bổ lại / bù thùng (dòng SHORT, thùng hư đã loại), hoặc báo thiếu thùng đã
 * về khu chờ xuất (dòng STAGED, docs 20 §4.9 bước 4); không có thì `null`. UI-only — Backend phải re-check.
 */
export function pickLineAction(
  task: FulfillmentGateState,
  actor: FulfillmentActor,
  line: Pick<PickLine, "status" | "removalReason" | "replacementPending">,
): "reallocate" | "reportShort" | null {
  if (canReallocateLine(task, actor, line)) return "reallocate";
  return line.status === PICK_LINE_STATUS.STAGED && canReportStagedShort(task, actor)
    ? "reportShort"
    : null;
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
 * Action của task kèm điều kiện dòng: "Hoàn tất lấy hàng" chỉ khi mọi dòng PICKED / STAGED / CANCELLED — docs 07
 * §4.2 bước 6, BE `requireAllPicked` (409 PICK_LINES_INCOMPLETE). Các action khác giữ nguyên.
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

/**
 * Hàng đợi trả về kệ — BE `FulfillmentController#putBacks` (`fulfillment-picking:READ`) / `#putBack`
 * (`fulfillment-picking:UPDATE`); bất kỳ ai có quyền của kho đó, không cần là người đã lấy.
 * UI-only — Backend phải re-check (kể cả phạm vi kho: OUT_OF_DATA_SCOPE).
 */
export function canViewPutBacks(actor: FulfillmentActor): boolean {
  return actor.can(FULFILLMENT_PICKING_PERMISSIONS.read);
}

export function canPutBack(actor: FulfillmentActor): boolean {
  return canViewPutBacks(actor) && actor.can(FULFILLMENT_PICKING_PERMISSIONS.update);
}

/**
 * Mở được chi tiết task của người khác (vd từ hàng đợi trả về kệ) — BE `TaskAccess.requireVisible`: ngoài người
 * được gán, chỉ ai có `fulfillment-task-oversight:READ` (hoặc người đóng gói khi task đã lấy xong); còn lại 404.
 * UI-only — Backend phải re-check (kể cả phạm vi kho).
 */
export function canOpenOthersTask(actor: FulfillmentActor): boolean {
  return actor.can(FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS.read);
}
