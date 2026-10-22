/**
 * Shipping — action-gating chuyến xe (feature-architecture §6).
 *
 * Bảng `LOAD_TRANSITIONS` (lib/domain, BE `LoadStatus`). Từ BE PR #148 mỗi endpoint gate bằng MỘT mã
 * quyền, không còn `@PreAuthorize` theo vai trò: mở chuyến `fulfillment-dispatch:CREATE`; thêm / bớt lô,
 * quét, bàn giao `fulfillment-dispatch:UPDATE`; huỷ chuyến `fulfillment-load-cancellations:UPDATE`.
 * Chuyến nguyên xe (FTL, BE PR #162) là một xe của kế hoạch xếp xe, cũng `fulfillment-dispatch:UPDATE`: đặt xe,
 * huỷ đặt xe, bắt đầu xếp, quét, dỡ kiện, bàn giao theo xe. Lô do kế hoạch quản lý nên thêm / bỏ lô và huỷ
 * chuyến chỉ cho chuyến gửi kiện (409 LOAD_MANAGED_BY_PLAN).
 * UI-only — Backend phải re-check (trạng thái chuyến, kiện thuộc biên bản, quyền + phạm vi kho).
 */

import {
  DELIVERY_MODES,
  FULFILLMENT_DISPATCH_PERMISSIONS,
  FULFILLMENT_LOAD_CANCELLATION_PERMISSIONS,
  LOAD_STATUS,
  UI_LABELS,
} from "@/constants";
import { LOAD_TRANSITIONS } from "@/lib/domain/lifecycle";

import { hasPendingUnloads } from "./ftl-selectors";

import type { DeliveryMode, LoadStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth";
import type { Load, LoadApiStatus } from "./types";

const D = UI_LABELS.shipping.load.disabledReason;
const N = UI_LABELS.shipping.load.noActions;
const F = UI_LABELS.shipping.ftl;

/** Người đang đăng nhập: mã quyền (`/identity/me/permissions`). */
export interface ShippingActor {
  can: (code: PermissionCode) => boolean;
}

export type LoadActionCode =
  | "addShipment"
  | "removeShipment"
  | "scan"
  | "unscan"
  | "handover"
  | "cancel"
  | "book"
  | "cancelBooking"
  | "startLoading"
  | "unload";

const PARCEL_ONLY: readonly DeliveryMode[] = ["PARCEL"];
const FTL_ONLY: readonly DeliveryMode[] = ["FULL_TRUCKLOAD"];
const BOTH_MODES = DELIVERY_MODES;

interface LoadAction {
  readonly code: LoadActionCode;
  /** Mã quyền BE bảo vệ endpoint (`@RequiresPermission`). */
  readonly permission: PermissionCode;
  readonly fromStatuses: readonly LoadApiStatus[];
  readonly targetStatus?: LoadStatus;
  /** Hình thức giao mà thao tác áp dụng. */
  readonly modes: readonly DeliveryMode[];
  /** BR-03 docs 09: mọi kiện của các lô trên biên bản phải đã lên xe. */
  readonly requiresFullyLoaded?: boolean;
}

const { PLANNED, VEHICLE_BOOKED, LOADING } = LOAD_STATUS;
const OPEN = [PLANNED, VEHICLE_BOOKED, LOADING] as const;
const UPDATE = FULFILLMENT_DISPATCH_PERMISSIONS.update;

export const LOAD_ACTIONS: readonly LoadAction[] = [
  // BE `DispatchLoad`: lô vào / ra biên bản khi chuyến còn mở
  {
    code: "addShipment",
    permission: UPDATE,
    fromStatuses: OPEN,
    modes: PARCEL_ONLY,
  },
  {
    code: "removeShipment",
    permission: UPDATE,
    fromStatuses: OPEN,
    modes: PARCEL_ONLY,
  },
  // Chuyến gửi kiện bắt đầu ở LOADING; quét / gỡ kiện chỉ khi đang xếp
  {
    code: "scan",
    permission: UPDATE,
    fromStatuses: [LOAD_STATUS.LOADING],
    modes: BOTH_MODES,
  },
  {
    code: "unscan",
    permission: UPDATE,
    fromStatuses: [LOAD_STATUS.LOADING],
    modes: BOTH_MODES,
  },
  {
    code: "handover",
    permission: UPDATE,
    fromStatuses: [LOAD_STATUS.LOADING],
    targetStatus: LOAD_STATUS.DISPATCHED,
    modes: BOTH_MODES,
    requiresFullyLoaded: true,
  },
  {
    code: "cancel",
    permission: FULFILLMENT_LOAD_CANCELLATION_PERMISSIONS.update,
    fromStatuses: OPEN,
    targetStatus: LOAD_STATUS.CANCELLED,
    modes: PARCEL_ONLY,
  },
  // BE PR #162, chuyến nguyên xe: đặt xe (đặt lại khi còn VEHICLE_BOOKED = thay thông tin), huỷ đặt xe (về
  // PLANNED, chỉ trước LOADING), xe tới kho thì bắt đầu xếp, dỡ kiện của đơn đã huỷ
  { code: "book", permission: UPDATE, fromStatuses: [PLANNED, VEHICLE_BOOKED], modes: FTL_ONLY },
  {
    code: "cancelBooking",
    permission: UPDATE,
    fromStatuses: [VEHICLE_BOOKED],
    targetStatus: PLANNED,
    modes: FTL_ONLY,
  },
  {
    code: "startLoading",
    permission: UPDATE,
    fromStatuses: [VEHICLE_BOOKED],
    targetStatus: LOADING,
    modes: FTL_ONLY,
  },
  { code: "unload", permission: UPDATE, fromStatuses: [LOADING], modes: FTL_ONLY },
];

export type LoadGateState = Pick<
  Load,
  "status" | "mode" | "shipmentCount" | "expectedPackageCount" | "loadedPackageCount"
> &
  Partial<Pick<Load, "pendingUnloads">>;

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
      load.mode !== "UNKNOWN" &&
      action.modes.includes(load.mode),
  ).map((action) => {
    if (!action.requiresFullyLoaded) return { action };
    if (load.shipmentCount === 0) return { action, disabledReason: D.empty };
    // BE 409 LOAD_UNLOAD_PENDING: kiện của đơn đã huỷ còn trên xe thì chưa ký được
    if (hasPendingUnloads(load)) return { action, disabledReason: F.disabledReason.unloadPending };
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
export function loadNoActionReason(load: LoadGateState): string {
  if (load.status === LOAD_STATUS.DISPATCHED) return N.dispatched;
  if (load.status === LOAD_STATUS.CANCELLED) return N.cancelled;
  if (load.mode === "FULL_TRUCKLOAD") {
    if (load.status === LOAD_STATUS.PLANNED) return F.noActions.planned;
    if (load.status === LOAD_STATUS.VEHICLE_BOOKED) return F.noActions.booked;
  }
  return N.viewOnly;
}

/** Chuyến còn mở: lô và kiện còn thêm / bớt được. */
export function isLoadOpen(status: LoadApiStatus): boolean {
  return (OPEN as readonly string[]).includes(status);
}
