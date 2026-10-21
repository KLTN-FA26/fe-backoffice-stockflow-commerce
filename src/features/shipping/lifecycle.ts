/**
 * Shipping — action-gating chuyến xe (feature-architecture §6).
 *
 * Bảng `LOAD_TRANSITIONS` (lib/domain, BE `LoadStatus`). BE gate KÉP mỗi endpoint: mã quyền
 * (`@RequiresPermission fulfillment-shipments`) VÀ vai trò (`@PreAuthorize`): mở / quét / bàn giao là
 * nhân viên kho, huỷ chuyến là quản lý kho — điều phối đơn hàng có UPDATE trên resource này (để ghi kết
 * quả giao) nhưng không được lên xe. SYSTEM_ADMIN qua mọi cổng vai trò (BE RoleHierarchyConfig).
 * Chỉ chuyến gửi kiện (PARCEL) xử lý ở đây; chuyến nguyên xe thuộc Kế hoạch xếp xe (SCRUM-287/452).
 * UI-only — Backend phải re-check (trạng thái chuyến, kiện thuộc biên bản, quyền + phạm vi kho).
 */

import { LOAD_STATUS, SHIPMENT_PERMISSIONS, STAFF_ROLE, UI_LABELS } from "@/constants";
import { LOAD_TRANSITIONS } from "@/lib/domain/lifecycle";

import type { LoadStatus, StaffRole } from "@/constants";
import type { PermissionCode } from "@/lib/auth";
import type { Load, LoadApiStatus } from "./types";

const { SYSTEM_ADMIN, WAREHOUSE_MANAGER, WAREHOUSE_STAFF } = STAFF_ROLE;
const D = UI_LABELS.shipping.load.disabledReason;
const N = UI_LABELS.shipping.load.noActions;

/** Người đang đăng nhập: mã quyền + mã vai trò BE (cùng response `/identity/me/permissions`). */
export interface ShippingActor {
  can: (code: PermissionCode) => boolean;
  roles: readonly string[];
}

/** Vai trò BE cho phép; SYSTEM_ADMIN qua mọi cổng. */
export function hasStaffRole(actor: ShippingActor, roles: readonly StaffRole[]): boolean {
  return actor.roles.some((role) => role === SYSTEM_ADMIN || roles.some((r) => r === role));
}

export const DISPATCH_ROLES: readonly StaffRole[] = [WAREHOUSE_STAFF, WAREHOUSE_MANAGER];

export type LoadActionCode =
  "addShipment" | "removeShipment" | "scan" | "unscan" | "handover" | "cancel";

interface LoadAction {
  readonly code: LoadActionCode;
  readonly permission: PermissionCode;
  readonly roles: readonly StaffRole[];
  readonly fromStatuses: readonly LoadApiStatus[];
  readonly targetStatus?: LoadStatus;
  /** Chỉ chuyến gửi kiện; huỷ chuyến áp cho cả chuyến nguyên xe. */
  readonly parcelOnly: boolean;
  /** BR-03 docs 09: mọi kiện của các lô trên biên bản phải đã lên xe. */
  readonly requiresFullyLoaded?: boolean;
}

const OPEN = [LOAD_STATUS.PLANNED, LOAD_STATUS.VEHICLE_BOOKED, LOAD_STATUS.LOADING] as const;
const UPDATE = SHIPMENT_PERMISSIONS.update;

export const LOAD_ACTIONS: readonly LoadAction[] = [
  // BE `DispatchLoad`: lô vào / ra biên bản khi chuyến còn mở
  {
    code: "addShipment",
    permission: UPDATE,
    roles: DISPATCH_ROLES,
    fromStatuses: OPEN,
    parcelOnly: true,
  },
  {
    code: "removeShipment",
    permission: UPDATE,
    roles: DISPATCH_ROLES,
    fromStatuses: OPEN,
    parcelOnly: true,
  },
  // Chuyến gửi kiện bắt đầu ở LOADING; quét / gỡ kiện chỉ khi đang xếp
  {
    code: "scan",
    permission: UPDATE,
    roles: DISPATCH_ROLES,
    fromStatuses: [LOAD_STATUS.LOADING],
    parcelOnly: true,
  },
  {
    code: "unscan",
    permission: UPDATE,
    roles: DISPATCH_ROLES,
    fromStatuses: [LOAD_STATUS.LOADING],
    parcelOnly: true,
  },
  {
    code: "handover",
    permission: UPDATE,
    roles: DISPATCH_ROLES,
    fromStatuses: [LOAD_STATUS.LOADING],
    targetStatus: LOAD_STATUS.DISPATCHED,
    parcelOnly: true,
    requiresFullyLoaded: true,
  },
  {
    code: "cancel",
    permission: UPDATE,
    roles: [WAREHOUSE_MANAGER],
    fromStatuses: OPEN,
    targetStatus: LOAD_STATUS.CANCELLED,
    parcelOnly: false,
  },
];

export type LoadGateState = Pick<
  Load,
  "status" | "mode" | "shipmentCount" | "expectedPackageCount" | "loadedPackageCount"
>;

export interface AllowedLoadAction {
  action: LoadAction;
  disabledReason?: string;
}

/** Mọi kiện cần lên xe đã lên xe (và có ít nhất một kiện). */
export function isFullyLoaded(
  load: Pick<LoadGateState, "expectedPackageCount" | "loadedPackageCount">,
): boolean {
  return load.expectedPackageCount > 0 && load.loadedPackageCount >= load.expectedPackageCount;
}

function transitionAllowed(status: LoadApiStatus, target: LoadStatus | undefined): boolean {
  if (!target) return true;
  return status !== "UNKNOWN" && LOAD_TRANSITIONS[status].includes(target);
}

export function allowedLoadActions(
  load: LoadGateState,
  actor: ShippingActor,
): readonly AllowedLoadAction[] {
  return LOAD_ACTIONS.filter(
    (action) =>
      action.fromStatuses.includes(load.status) &&
      transitionAllowed(load.status, action.targetStatus) &&
      actor.can(action.permission) &&
      hasStaffRole(actor, action.roles) &&
      (!action.parcelOnly || load.mode === "PARCEL"),
  ).map((action) => {
    if (!action.requiresFullyLoaded) return { action };
    if (load.shipmentCount === 0) return { action, disabledReason: D.empty };
    return isFullyLoaded(load) ? { action } : { action, disabledReason: D.notFullyLoaded };
  });
}

export function hasLoadAction(
  actions: readonly AllowedLoadAction[],
  code: LoadActionCode,
): AllowedLoadAction | undefined {
  return actions.find(({ action }) => action.code === code);
}

/** Câu thay cho nút khi không còn thao tác nào (người dùng hiểu vì sao ô quét / nút không có). */
export function loadNoActionReason(load: LoadGateState, actor: ShippingActor): string {
  if (load.status === LOAD_STATUS.DISPATCHED) return N.dispatched;
  if (load.status === LOAD_STATUS.CANCELLED) return N.cancelled;
  if (load.mode !== "PARCEL") return D.notParcel;
  if (!actor.can(UPDATE)) return N.viewOnly;
  if (!hasStaffRole(actor, DISPATCH_ROLES)) return N.notDispatcher;
  return N.viewOnly;
}

/** Chuyến còn mở: lô và kiện còn thêm / bớt được. */
export function isLoadOpen(status: LoadApiStatus): boolean {
  return (OPEN as readonly string[]).includes(status);
}
