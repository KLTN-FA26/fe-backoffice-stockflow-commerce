/**
 * Shipping — action-gating chuyến xe (feature-architecture §6).
 *
 * Bảng `LOAD_TRANSITIONS` (lib/domain, BE `LoadStatus`). Mọi chuyến là MỘT XE của kế hoạch xếp xe (giao nguyên chuyến,
 * docs 09 BR-08) — không còn `mode`, không còn thêm / bớt lô hay huỷ chuyến tay. Mỗi endpoint gate bằng một mã quyền
 * (BE `@RequiresPermission`): đặt xe, huỷ đặt xe, bắt đầu xếp, quét, dỡ kiện, nhập mã vận đơn, bàn giao =
 * `fulfillment-dispatch:UPDATE`; huỷ có kiểm soát MỘT xe và xác nhận dỡ không quét =
 * `fulfillment-controlled-cancellations:UPDATE` (SCRUM-474, BR-14); SỬA mã vận đơn sau khi chuyến rời kho cần thêm
 * `fulfillment-waybill-corrections:UPDATE` (BR-24). UI-only — Backend phải re-check (trạng thái chuyến, kiện thuộc
 * biên bản, quyền + phạm vi kho).
 */

import {
  FULFILLMENT_CONTROLLED_CANCELLATION_PERMISSIONS,
  FULFILLMENT_DISPATCH_PERMISSIONS,
  FULFILLMENT_WAYBILL_CORRECTION_PERMISSIONS,
  LOAD_STATUS,
  UI_LABELS,
} from "@/constants";
import { LOAD_TRANSITIONS } from "@/lib/domain/lifecycle";

import { hasPendingUnloads, isApiBookedLoad } from "./ftl-selectors";

import type { LoadStatus } from "@/constants";
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
  | "scan"
  | "unscan"
  | "handover"
  | "book"
  | "cancelBooking"
  | "startLoading"
  | "recordWaybill"
  | "correctWaybill"
  | "unload"
  | "controlledCancel"
  | "overrideUnload";

interface LoadAction {
  readonly code: LoadActionCode;
  /** Mã quyền BE bảo vệ endpoint (`@RequiresPermission`). */
  readonly permission: PermissionCode;
  /** Mã quyền thêm mà dịch vụ BE kiểm riêng (sửa mã vận đơn sau khi rời kho). */
  readonly alsoPermission?: PermissionCode;
  readonly fromStatuses: readonly LoadApiStatus[];
  readonly targetStatus?: LoadStatus;
  /** BR-18 docs 09: mọi kiện kế hoạch xếp lên xe phải đã lên xe. */
  readonly requiresFullyLoaded?: boolean;
}

const { PLANNED, VEHICLE_BOOKED, LOADING, DISPATCHED, CANCELLED } = LOAD_STATUS;
const UPDATE = FULFILLMENT_DISPATCH_PERMISSIONS.update;
const CONTROLLED = FULFILLMENT_CONTROLLED_CANCELLATION_PERMISSIONS.update;

export const LOAD_ACTIONS: readonly LoadAction[] = [
  // Quét / gỡ kiện chỉ khi đang xếp
  { code: "scan", permission: UPDATE, fromStatuses: [LOADING] },
  { code: "unscan", permission: UPDATE, fromStatuses: [LOADING] },
  {
    code: "handover",
    permission: UPDATE,
    fromStatuses: [LOADING],
    targetStatus: DISPATCHED,
    requiresFullyLoaded: true,
  },
  // Đặt xe (đặt lại khi còn VEHICLE_BOOKED = thay thông tin; hãng API không đặt lại tay — xem allowedLoadActions),
  // huỷ đặt xe (về PLANNED, chỉ trước LOADING), xe tới kho thì bắt đầu xếp (BR-14)
  { code: "book", permission: UPDATE, fromStatuses: [PLANNED, VEHICLE_BOOKED] },
  {
    code: "cancelBooking",
    permission: UPDATE,
    fromStatuses: [VEHICLE_BOOKED],
    targetStatus: PLANNED,
  },
  {
    code: "startLoading",
    permission: UPDATE,
    fromStatuses: [VEHICLE_BOOKED],
    targetStatus: LOADING,
  },
  // Mã vận đơn (docs 09 §4.4): chỉ điền cho chuyến đã đặt xe, chưa huỷ; sau khi rời kho chỉ quản lý kho SỬA, kèm lý do (BR-24)
  { code: "recordWaybill", permission: UPDATE, fromStatuses: [VEHICLE_BOOKED, LOADING] },
  {
    code: "correctWaybill",
    permission: UPDATE,
    alsoPermission: FULFILLMENT_WAYBILL_CORRECTION_PERMISSIONS.update,
    fromStatuses: [DISPATCHED],
  },
  // Quét dỡ cả trên xe đã huỷ có kiểm soát: kiện của nó bị khoá tới khi dỡ (SCRUM-474 UNLOAD-DESIGN điểm 4)
  { code: "unload", permission: UPDATE, fromStatuses: [LOADING, CANCELLED] },
  // SCRUM-474 UNLOAD-DESIGN điểm 2, 5, 6: huỷ có kiểm soát MỘT xe đang xếp hàng, và xác nhận dỡ kiện không quét (nhãn
  // hỏng) — chung MỘT mã quyền của quản lý kho. Backend phải re-check (BR-14).
  {
    code: "controlledCancel",
    permission: CONTROLLED,
    fromStatuses: [LOADING],
    targetStatus: CANCELLED,
  },
  { code: "overrideUnload", permission: CONTROLLED, fromStatuses: [LOADING, CANCELLED] },
];

export type LoadGateState = Pick<
  Load,
  "status" | "shipmentCount" | "expectedPackageCount" | "loadedPackageCount"
> &
  Partial<Pick<Load, "pendingUnloads" | "carrierId" | "carrierConnectionType">>;

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

/** Điều kiện riêng của từng thao tác ngoài trạng thái + quyền (hãng API đặt xe — BR-29, §4.4 (4)). */
function loadAllows(action: LoadAction, load: LoadGateState): boolean {
  switch (action.code) {
    // Đặt lại bằng tay không áp cho đơn đã tạo ở hãng API: phải huỷ đặt xe (huỷ đơn ở hãng) rồi đặt lại
    case "book":
      return !(load.status === VEHICLE_BOOKED && isApiBookedLoad(load));
    // Mã vận đơn của hãng API là mã đơn hãng trả về — không nhập tay; cần đã có hãng
    case "recordWaybill":
    case "correctWaybill":
      return !!load.carrierId && !isApiBookedLoad(load);
    default:
      return true;
  }
}

export function allowedLoadActions(
  load: LoadGateState,
  actor: ShippingActor,
): readonly AllowedLoadAction[] {
  return LOAD_ACTIONS.filter(
    (action) =>
      action.fromStatuses.includes(load.status) &&
      // Xe đã huỷ chỉ còn việc dỡ khi còn kiện bị khoá (SCRUM-474): hết kiện thì không còn thao tác nào
      (load.status !== CANCELLED || hasPendingUnloads(load)) &&
      transitionAllowed(load.status, action.targetStatus) &&
      actor.can(action.permission) &&
      (!action.alsoPermission || actor.can(action.alsoPermission)) &&
      loadAllows(action, load),
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
export function loadNoActionReason(load: Pick<Load, "status">): string {
  if (load.status === DISPATCHED) return N.dispatched;
  if (load.status === CANCELLED) return N.cancelled;
  if (load.status === PLANNED) return F.noActions.planned;
  if (load.status === VEHICLE_BOOKED) return F.noActions.booked;
  return N.viewOnly;
}
