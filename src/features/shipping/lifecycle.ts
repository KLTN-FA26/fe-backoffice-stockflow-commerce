/**
 * Shipping — action-gating chuyến xe (feature-architecture §6).
 *
 * Bảng `LOAD_TRANSITIONS` (lib/domain, BE `LoadStatus`). Từ BE PR #148 mỗi endpoint gate bằng MỘT mã
 * quyền, không còn `@PreAuthorize` theo vai trò: mở chuyến `fulfillment-dispatch:CREATE`; thêm / bớt lô,
 * quét, bàn giao `fulfillment-dispatch:UPDATE`; huỷ chuyến `fulfillment-load-cancellations:UPDATE`.
 * Chỉ chuyến gửi kiện (PARCEL) xử lý ở đây; chuyến nguyên xe thuộc Kế hoạch xếp xe (SCRUM-287/452).
 * UI-only — Backend phải re-check (trạng thái chuyến, kiện thuộc biên bản, quyền + phạm vi kho).
 */

import {
  FULFILLMENT_DISPATCH_PERMISSIONS,
  FULFILLMENT_LOAD_CANCELLATION_PERMISSIONS,
  LOAD_STATUS,
  UI_LABELS,
} from "@/constants";
import { LOAD_TRANSITIONS } from "@/lib/domain/lifecycle";

import type { LoadStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth";
import type { Load, LoadApiStatus } from "./types";

const D = UI_LABELS.shipping.load.disabledReason;
const N = UI_LABELS.shipping.load.noActions;

/** Người đang đăng nhập: mã quyền (`/identity/me/permissions`). */
export interface ShippingActor {
  can: (code: PermissionCode) => boolean;
}

export type LoadActionCode =
  "addShipment" | "removeShipment" | "scan" | "unscan" | "handover" | "cancel";

interface LoadAction {
  readonly code: LoadActionCode;
  /** Mã quyền BE bảo vệ endpoint (`@RequiresPermission`). */
  readonly permission: PermissionCode;
  readonly fromStatuses: readonly LoadApiStatus[];
  readonly targetStatus?: LoadStatus;
  /** Chỉ chuyến gửi kiện; huỷ chuyến áp cho cả chuyến nguyên xe. */
  readonly parcelOnly: boolean;
  /** BR-03 docs 09: mọi kiện của các lô trên biên bản phải đã lên xe. */
  readonly requiresFullyLoaded?: boolean;
}

const OPEN = [LOAD_STATUS.PLANNED, LOAD_STATUS.VEHICLE_BOOKED, LOAD_STATUS.LOADING] as const;
const UPDATE = FULFILLMENT_DISPATCH_PERMISSIONS.update;

export const LOAD_ACTIONS: readonly LoadAction[] = [
  // BE `DispatchLoad`: lô vào / ra biên bản khi chuyến còn mở
  {
    code: "addShipment",
    permission: UPDATE,
    fromStatuses: OPEN,
    parcelOnly: true,
  },
  {
    code: "removeShipment",
    permission: UPDATE,
    fromStatuses: OPEN,
    parcelOnly: true,
  },
  // Chuyến gửi kiện bắt đầu ở LOADING; quét / gỡ kiện chỉ khi đang xếp
  {
    code: "scan",
    permission: UPDATE,
    fromStatuses: [LOAD_STATUS.LOADING],
    parcelOnly: true,
  },
  {
    code: "unscan",
    permission: UPDATE,
    fromStatuses: [LOAD_STATUS.LOADING],
    parcelOnly: true,
  },
  {
    code: "handover",
    permission: UPDATE,
    fromStatuses: [LOAD_STATUS.LOADING],
    targetStatus: LOAD_STATUS.DISPATCHED,
    parcelOnly: true,
    requiresFullyLoaded: true,
  },
  {
    code: "cancel",
    permission: FULFILLMENT_LOAD_CANCELLATION_PERMISSIONS.update,
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
export function loadNoActionReason(load: LoadGateState): string {
  if (load.status === LOAD_STATUS.DISPATCHED) return N.dispatched;
  if (load.status === LOAD_STATUS.CANCELLED) return N.cancelled;
  if (load.mode !== "PARCEL") return D.notParcel;
  return N.viewOnly;
}

/** Chuyến còn mở: lô và kiện còn thêm / bớt được. */
export function isLoadOpen(status: LoadApiStatus): boolean {
  return (OPEN as readonly string[]).includes(status);
}
