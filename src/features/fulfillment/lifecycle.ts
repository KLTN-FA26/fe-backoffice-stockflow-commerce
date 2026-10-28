/**
 * Fulfillment task — action-gating (feature-architecture §6).
 *
 * Bảng chuyển trạng thái dùng chung `PICK_TRANSITIONS` / `PACK_TRANSITIONS` (lib/domain).
 * Thao tác của trạm đóng gói (nhận đơn, kiện, quét, hoàn tất) gate ở `packing-lifecycle.ts`; ở đây còn
 * gán / lấy hàng / kiểm tra lại thiết kế. Từ BE PR #148 mỗi endpoint chỉ gate bằng MỘT mã quyền
 * (`@RequiresPermission`, không còn `@PreAuthorize` theo vai trò) — FE không đọc tên vai trò để quyết định
 * quyền. Phần lớn thao tác lấy hàng còn đòi người gọi là người được gán, nên ở đây kiểm: trạng thái,
 * mã quyền, người được gán.
 * UI-only — Backend phải re-check (FulfillmentController + FulfillmentServiceImpl).
 */

import {
  FULFILLMENT_DESIGN_REVERIFICATION_PERMISSIONS,
  FULFILLMENT_PACKAGE_PERMISSIONS,
  FULFILLMENT_PACKING_PERMISSIONS,
  FULFILLMENT_PICKING_PERMISSIONS,
  FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS,
  PACK_STATUS,
  PICK_STATUS,
  UI_LABELS,
} from "@/constants";
import { PACK_TRANSITIONS, PICK_TRANSITIONS } from "@/lib/domain/lifecycle";

import type { PackStatus, PickStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth";

const LABEL = UI_LABELS.fulfillment.action;
const ASSIGNMENT = FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS;
const PICKING = FULFILLMENT_PICKING_PERMISSIONS;
const REVERIFY = FULFILLMENT_DESIGN_REVERIFICATION_PERMISSIONS;

/** Người đang đăng nhập, đủ để tính quyền thao tác trên một task. */
export interface FulfillmentActor {
  can: (code: PermissionCode) => boolean;
  userId: string | null;
}

export interface FulfillmentGateState {
  pickStatus: PickStatus;
  packStatus: PackStatus;
  assignedUserId?: string | null;
}

export type FulfillmentActionCode = "assign" | "startPicking" | "completePicking" | "reverify";

interface StatusGate<S extends string> {
  readonly from: readonly S[];
  /** Đích trong bảng chuyển trạng thái; thiếu = không đổi trạng thái (gán lại). */
  readonly to?: S;
}

export interface FulfillmentAction {
  readonly code: FulfillmentActionCode;
  readonly label: string;
  /** Mã quyền BE bảo vệ endpoint (`@RequiresPermission`). */
  readonly permission: PermissionCode;
  /** BE `pick.requireAssigned(actor)` — quản lý kho cũng không làm hộ. */
  readonly assigneeOnly: boolean;
  readonly pick?: StatusGate<PickStatus>;
  readonly pack?: StatusGate<PackStatus>;
}

export const FULFILLMENT_ACTIONS: readonly FulfillmentAction[] = [
  {
    code: "assign",
    label: LABEL.assign,
    // BE `PUT /tasks/{id}/assignment` — fulfillment-task-assignment:UPDATE
    permission: ASSIGNMENT.update,
    assigneeOnly: false,
    // BE `PickJpaEntity#assign`: chỉ gán khi pick còn PENDING
    pick: { from: [PICK_STATUS.PENDING] },
  },
  {
    code: "startPicking",
    label: LABEL.startPicking,
    // BE `POST /tasks/{id}/picking-start` — fulfillment-picking:UPDATE
    permission: PICKING.update,
    assigneeOnly: true,
    pick: { from: [PICK_STATUS.PENDING], to: PICK_STATUS.PICKING },
  },
  {
    code: "completePicking",
    label: LABEL.completePicking,
    // BE `POST /tasks/{id}/picking-completion` — fulfillment-picking:UPDATE
    permission: PICKING.update,
    assigneeOnly: true,
    pick: { from: [PICK_STATUS.PICKING], to: PICK_STATUS.PICKED },
  },
  {
    code: "reverify",
    label: LABEL.reverify,
    // X-CHK (BR-DSG-003, docs 08): BE PR #148 — `POST /tasks/{id}/design-integrity-reverification`
    // là fulfillment-design-reverification:UPDATE (seed QC_STAFF, WAREHOUSE_MANAGER), không cần là người
    // được gán lấy hàng
    permission: REVERIFY.update,
    assigneeOnly: false,
    // BE PR #136: kiểm tra lại khớp → phiên về PACKING, người đóng gói hoàn tất lại (không ra PACKED)
    pack: { from: [PACK_STATUS.ON_HOLD], to: PACK_STATUS.PACKING },
  },
];

export function isAssignee(task: FulfillmentGateState, actor: FulfillmentActor): boolean {
  return actor.userId !== null && task.assignedUserId === actor.userId;
}

function passes<S extends string>(
  gate: StatusGate<S> | undefined,
  status: S,
  table: Record<S, readonly S[]>,
): boolean {
  if (!gate) return true;
  return gate.from.includes(status) && (!gate.to || table[status].includes(gate.to));
}

function allowedByStatus(action: FulfillmentAction, task: FulfillmentGateState): boolean {
  return (
    passes(action.pick, task.pickStatus, PICK_TRANSITIONS) &&
    passes(action.pack, task.packStatus, PACK_TRANSITIONS)
  );
}

/**
 * Action khả dụng cho task + người dùng: 1. trạng thái pick/pack và bảng chuyển trạng thái;
 * 2. mã quyền; 3. là người được gán (nếu action đòi).
 */
export function allowedFulfillmentActions(
  task: FulfillmentGateState,
  actor: FulfillmentActor,
): readonly FulfillmentAction[] {
  return FULFILLMENT_ACTIONS.filter(
    (action) =>
      allowedByStatus(action, task) &&
      actor.can(action.permission) &&
      (!action.assigneeOnly || isAssignee(task, actor)),
  );
}

/**
 * Người dùng đủ quyền cho một action đang mở theo trạng thái, nhưng không phải người
 * được gán → màn hình giải thích thay vì chỉ ẩn nút.
 */
export function isBlockedAsNonAssignee(
  task: FulfillmentGateState,
  actor: FulfillmentActor,
  codes: readonly FulfillmentActionCode[],
): boolean {
  return FULFILLMENT_ACTIONS.some(
    (action) =>
      codes.includes(action.code) &&
      action.assigneeOnly &&
      allowedByStatus(action, task) &&
      actor.can(action.permission) &&
      !isAssignee(task, actor),
  );
}

/** Tạo task: BE `POST /fulfillment/tasks` — fulfillment-task-assignment:CREATE. */
export function canCreateTask(actor: FulfillmentActor): boolean {
  return actor.can(ASSIGNMENT.create);
}

/**
 * Tải artifact thiết kế: endpoint cần packages:READ; BE `TaskAccess.requireArtifactAccess` cho qua người
 * được gán, người có design-reverification:READ (quản lý kho / QC) và — khi lấy hàng đã xong — người
 * có fulfillment-packing:UPDATE (người đóng gói). Điều phối đơn không có quyền nào trong số đó.
 */
export function canDownloadArtifact(task: FulfillmentGateState, actor: FulfillmentActor): boolean {
  if (!actor.can(FULFILLMENT_PACKAGE_PERMISSIONS.read) || isTaskCancelled(task)) return false;
  if (isAssignee(task, actor) || actor.can(REVERIFY.read)) return true;
  return (
    task.pickStatus === PICK_STATUS.PICKED && actor.can(FULFILLMENT_PACKING_PERMISSIONS.update)
  );
}

/** Đơn bị huỷ → BE huỷ cả pick lẫn pack (OrderCancellationListener). */
export function isTaskCancelled(task: FulfillmentGateState): boolean {
  return task.pickStatus === PICK_STATUS.CANCELLED || task.packStatus === PACK_STATUS.CANCELLED;
}

/** Task không còn thao tác nào: đã đóng gói xong hoặc đã huỷ. */
export function isTaskClosed(task: FulfillmentGateState): boolean {
  return isTaskCancelled(task) || PACK_TRANSITIONS[task.packStatus].length === 0;
}
