/**
 * Fulfillment task — action-gating (feature-architecture §6).
 *
 * Bảng chuyển trạng thái dùng chung `PICK_TRANSITIONS` / `PACK_TRANSITIONS` (lib/domain).
 * BE gate KÉP mỗi endpoint: mã quyền (`@RequiresPermission`) VÀ vai trò (`@PreAuthorize`), và
 * phần lớn thao tác còn đòi người gọi là người được gán — nên ở đây kiểm cả ba, khác các màn chỉ
 * gate theo mã quyền. Vai trò đọc từ `/identity/me/permissions.roles`.
 * UI-only — Backend phải re-check (FulfillmentController + FulfillmentServiceImpl).
 */

import {
  FULFILLMENT_PACKAGE_PERMISSIONS,
  FULFILLMENT_PICK_PERMISSIONS,
  PACK_STATUS,
  PICK_STATUS,
  STAFF_ROLE,
  UI_LABELS,
} from "@/constants";
import { PACK_TRANSITIONS, PICK_TRANSITIONS } from "@/lib/domain/lifecycle";

import type { PackStatus, PickStatus, StaffRole } from "@/constants";
import type { PermissionCode } from "@/lib/auth";

const LABEL = UI_LABELS.fulfillment.action;
const { ORDER_COORDINATOR, QC_STAFF, SYSTEM_ADMIN, WAREHOUSE_MANAGER, WAREHOUSE_STAFF } =
  STAFF_ROLE;

/** Người đang đăng nhập, đủ để tính quyền thao tác trên một task. */
export interface FulfillmentActor {
  can: (code: PermissionCode) => boolean;
  /** Mã vai trò BE của người dùng. */
  roles: readonly string[];
  userId: string | null;
}

export interface FulfillmentGateState {
  pickStatus: PickStatus;
  packStatus: PackStatus;
  assignedUserId?: string | null;
}

export type FulfillmentActionCode =
  "assign" | "startPicking" | "completePicking" | "completePacking" | "reverify";

interface StatusGate<S extends string> {
  readonly from: readonly S[];
  /** Đích trong bảng chuyển trạng thái; thiếu = không đổi trạng thái (gán lại). */
  readonly to?: S;
}

export interface FulfillmentAction {
  readonly code: FulfillmentActionCode;
  readonly label: string;
  readonly permission: PermissionCode;
  /** Vai trò BE cho phép (`@PreAuthorize hasAnyAuthority`). */
  readonly roles: readonly StaffRole[];
  /** BE `pick.requireAssigned(actor)` — quản lý kho cũng không làm hộ. */
  readonly assigneeOnly: boolean;
  readonly pick?: StatusGate<PickStatus>;
  readonly pack?: StatusGate<PackStatus>;
}

const FLOOR_ROLES = [WAREHOUSE_STAFF, WAREHOUSE_MANAGER] as const;

export const FULFILLMENT_ACTIONS: readonly FulfillmentAction[] = [
  {
    code: "assign",
    label: LABEL.assign,
    permission: FULFILLMENT_PICK_PERMISSIONS.update,
    roles: [ORDER_COORDINATOR, WAREHOUSE_MANAGER],
    assigneeOnly: false,
    // BE `PickJpaEntity#assign`: chỉ gán khi pick còn PENDING (docs 07 §5.1: Assigned → trả lại)
    pick: { from: [PICK_STATUS.ASSIGNED] },
  },
  {
    code: "startPicking",
    label: LABEL.startPicking,
    permission: FULFILLMENT_PICK_PERMISSIONS.update,
    roles: FLOOR_ROLES,
    assigneeOnly: true,
    pick: { from: [PICK_STATUS.ASSIGNED], to: PICK_STATUS.IN_PROGRESS },
  },
  {
    code: "completePicking",
    label: LABEL.completePicking,
    permission: FULFILLMENT_PICK_PERMISSIONS.update,
    roles: FLOOR_ROLES,
    assigneeOnly: true,
    pick: { from: [PICK_STATUS.IN_PROGRESS], to: PICK_STATUS.PICKED },
  },
  {
    code: "completePacking",
    label: LABEL.completePacking,
    permission: FULFILLMENT_PACKAGE_PERMISSIONS.create,
    roles: FLOOR_ROLES,
    assigneeOnly: true,
    // BE: "Picking must finish before packing"; kiện đang giữ phải qua kiểm tra lại (X-CHK)
    pick: { from: [PICK_STATUS.PICKED] },
    pack: { from: [PACK_STATUS.PENDING, PACK_STATUS.IN_PROGRESS], to: PACK_STATUS.PACKED },
  },
  {
    code: "reverify",
    label: LABEL.reverify,
    permission: FULFILLMENT_PACKAGE_PERMISSIONS.create,
    // X-CHK (BR-DSG-003): chỉ QC / quản lý kho gỡ giữ, không cần là người được gán
    roles: [QC_STAFF, WAREHOUSE_MANAGER],
    assigneeOnly: false,
    pack: { from: [PACK_STATUS.ON_HOLD], to: PACK_STATUS.PACKED },
  },
];

/** SYSTEM_ADMIN qua mọi cổng vai trò (BE RoleHierarchyConfig). */
export function hasStaffRole(actor: FulfillmentActor, roles: readonly StaffRole[]): boolean {
  return actor.roles.some((role) => role === SYSTEM_ADMIN || roles.some((r) => r === role));
}

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
 * 2. mã quyền; 3. vai trò BE; 4. là người được gán (nếu action đòi).
 */
export function allowedFulfillmentActions(
  task: FulfillmentGateState,
  actor: FulfillmentActor,
): readonly FulfillmentAction[] {
  return FULFILLMENT_ACTIONS.filter(
    (action) =>
      allowedByStatus(action, task) &&
      actor.can(action.permission) &&
      hasStaffRole(actor, action.roles) &&
      (!action.assigneeOnly || isAssignee(task, actor)),
  );
}

/**
 * Người dùng đủ quyền + vai trò cho một action đang mở theo trạng thái, nhưng không phải người
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
      hasStaffRole(actor, action.roles) &&
      !isAssignee(task, actor),
  );
}

/** Tạo task: BE `POST /fulfillment/tasks` — pick-lists:UPDATE + điều phối / quản lý kho. */
export function canCreateTask(actor: FulfillmentActor): boolean {
  return (
    actor.can(FULFILLMENT_PICK_PERMISSIONS.update) &&
    hasStaffRole(actor, [ORDER_COORDINATOR, WAREHOUSE_MANAGER])
  );
}

/**
 * Tải artifact thiết kế: packages:READ + (người được gán là NV kho, hoặc quản lý kho / QC).
 * Điều phối đơn bị loại ở cả `@PreAuthorize` lẫn `requireArtifactAccess`.
 */
export function canDownloadArtifact(task: FulfillmentGateState, actor: FulfillmentActor): boolean {
  if (!actor.can(FULFILLMENT_PACKAGE_PERMISSIONS.read) || isTaskCancelled(task)) return false;
  if (hasStaffRole(actor, [WAREHOUSE_MANAGER, QC_STAFF])) return true;
  return hasStaffRole(actor, [WAREHOUSE_STAFF]) && isAssignee(task, actor);
}

/** Đơn bị huỷ → BE huỷ cả pick lẫn pack (OrderCancellationListener). */
export function isTaskCancelled(task: FulfillmentGateState): boolean {
  return task.pickStatus === PICK_STATUS.CANCELLED || task.packStatus === PACK_STATUS.CANCELLED;
}

/** Task không còn thao tác nào: đã đóng gói xong hoặc đã huỷ. */
export function isTaskClosed(task: FulfillmentGateState): boolean {
  return isTaskCancelled(task) || PACK_TRANSITIONS[task.packStatus].length === 0;
}
