/**
 * Shipping — action-gating chuyến xe (feature-architecture §6).
 *
 * Bảng `LOAD_TRANSITIONS` (lib/domain, BE business-design 03-state-machines §11).
 * Quyền: `fulfillment-shipments` (ASSUMPTION contract SCRUM-288).
 * UI-only — Backend phải re-check (trạng thái chuyến, kiện thuộc chuyến, quyền + phạm vi kho).
 */

import { LOAD_STATUS, SHIPMENT_PERMISSIONS, UI_LABELS } from "@/constants";
import { LOAD_TRANSITIONS } from "@/lib/domain/lifecycle";

import type { LoadStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth";

const A = UI_LABELS.shipping.action;

export type LoadActionCode = "startLoading" | "scan" | "handover";

export interface LoadAction {
  readonly code: LoadActionCode;
  readonly label: string;
  readonly permissions: readonly PermissionCode[];
  readonly fromStatuses: readonly LoadStatus[];
  readonly targetStatus?: LoadStatus;
  /** 03 §11: LOADING → DISPATCHED chỉ khi mọi kiện kế hoạch đã quét lên xe. */
  readonly requiresFullyLoaded?: boolean;
}

export interface LoadGateState {
  status: LoadStatus;
  plannedPackages: number;
  loadedPackages: number;
}

export interface AllowedLoadAction {
  action: LoadAction;
  disabledReason?: string;
}

export const LOAD_ACTIONS: readonly LoadAction[] = [
  {
    code: "startLoading",
    label: A.startLoading,
    // Xe đã đặt tới dock (VEHICLE_BOOKED → LOADING, 03 §11)
    permissions: [SHIPMENT_PERMISSIONS.update],
    fromStatuses: [LOAD_STATUS.VEHICLE_BOOKED],
    targetStatus: LOAD_STATUS.LOADING,
  },
  {
    code: "scan",
    label: UI_LABELS.shipping.scan.label,
    // F-SHP bước 04: quét từng kiện lên xe, không đổi trạng thái chuyến
    permissions: [SHIPMENT_PERMISSIONS.update],
    fromStatuses: [LOAD_STATUS.LOADING],
  },
  {
    code: "handover",
    label: A.handover,
    permissions: [SHIPMENT_PERMISSIONS.update],
    fromStatuses: [LOAD_STATUS.LOADING],
    targetStatus: LOAD_STATUS.DISPATCHED,
    requiresFullyLoaded: true,
  },
];

export function isFullyLoaded(load: Pick<LoadGateState, "plannedPackages" | "loadedPackages">) {
  return load.plannedPackages > 0 && load.loadedPackages >= load.plannedPackages;
}

/** Trạng thái gate lấy từ `lines` — cùng nguồn với bảng đối soát, không lệch số đếm ở header. */
export function loadGateState(load: {
  status: LoadStatus;
  lines: readonly { loadedAt?: string | null }[];
}): LoadGateState {
  return {
    status: load.status,
    plannedPackages: load.lines.length,
    loadedPackages: load.lines.filter((line) => !!line.loadedAt).length,
  };
}

export function allowedLoadActions(
  load: LoadGateState,
  can: (code: PermissionCode) => boolean,
): readonly AllowedLoadAction[] {
  return LOAD_ACTIONS.filter((action) => {
    const allowedByTable =
      !action.targetStatus || LOAD_TRANSITIONS[load.status].includes(action.targetStatus);
    return (
      action.fromStatuses.includes(load.status) && allowedByTable && action.permissions.every(can)
    );
  }).map((action) =>
    action.requiresFullyLoaded && !isFullyLoaded(load)
      ? {
          action,
          disabledReason:
            load.plannedPackages === 0
              ? UI_LABELS.shipping.disabledReason.emptyLoad
              : UI_LABELS.shipping.disabledReason.notFullyLoaded,
        }
      : { action },
  );
}

const NO_ACTIONS = UI_LABELS.shipping.noActions;

/** Câu thay cho nút khi không còn thao tác (`Record` — thiếu trạng thái thì compiler báo). */
export const LOAD_NO_ACTION_REASON: Record<LoadStatus, string> = {
  PLANNED: NO_ACTIONS.planned,
  VEHICLE_BOOKED: NO_ACTIONS.viewOnly,
  LOADING: NO_ACTIONS.viewOnly,
  DISPATCHED: NO_ACTIONS.dispatched,
  CANCELLED: NO_ACTIONS.cancelled,
};

/** Xe đã đặt nhưng chưa bắt đầu xếp (03 §11) — màn quét nhắc bấm "Bắt đầu xếp hàng". */
export function isLoadAwaitingStart(status: LoadStatus): boolean {
  return status === LOAD_STATUS.VEHICLE_BOOKED;
}

/** Biên bản xem / in được khi đang xếp (đối soát) hoặc đã bàn giao (bản đã ký). */
export function hasManifestView(status: LoadStatus): boolean {
  return status === LOAD_STATUS.LOADING || status === LOAD_STATUS.DISPATCHED;
}

/** DISPATCHED / CANCELLED — không còn thao tác. */
export function isLoadTerminal(status: LoadStatus): boolean {
  return LOAD_TRANSITIONS[status].length === 0;
}
