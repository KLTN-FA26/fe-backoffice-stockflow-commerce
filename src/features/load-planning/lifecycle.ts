/**
 * Quyền thao tác trên kế hoạch xếp xe — mã quyền từ `/identity/me/permissions`, không theo tên vai trò.
 * Bảng chuyển trạng thái chép từ docs 09 §5 và `LoadPlan.requireStatus` của BE (PR #161):
 * DRAFT → PLANNED (tính) → CONFIRMED (chốt) → DISPATCHED (PR E, BE tự chuyển); DRAFT/PLANNED/CONFIRMED → CANCELLED;
 * CONFIRMED → PLANNED (mở lại, BR-14); đổi đầu vào đưa PLANNED về DRAFT. UI-only — Backend phải re-check
 * (`fulfillment-load-plans:CREATE` trên POST, `:UPDATE` trên mọi bước sau; BR-13, BR-14, LP-4).
 */

import { LOAD_PLAN_PERMISSIONS, LOAD_PLAN_STATUS, LOAD_STATUS } from "@/constants";

import type { LoadPlanStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth";
import type { PlanDetail } from "./plan-types";

export interface LoadPlanActor {
  can: (code: PermissionCode) => boolean;
}

export const LOAD_PLAN_TRANSITIONS = {
  DRAFT: [LOAD_PLAN_STATUS.PLANNED, LOAD_PLAN_STATUS.CANCELLED],
  PLANNED: [LOAD_PLAN_STATUS.DRAFT, LOAD_PLAN_STATUS.CONFIRMED, LOAD_PLAN_STATUS.CANCELLED],
  CONFIRMED: [LOAD_PLAN_STATUS.PLANNED, LOAD_PLAN_STATUS.DISPATCHED, LOAD_PLAN_STATUS.CANCELLED],
  DISPATCHED: [],
  CANCELLED: [],
} as const satisfies Record<LoadPlanStatus, readonly LoadPlanStatus[]>;

export type ConfirmBlock = "noVehicles" | "needsRecalculation" | "unplacedPending";

export interface LoadPlanActions {
  create: boolean;
  calculate: boolean;
  editInputs: boolean;
  recalculateVehicle: boolean;
  acknowledge: boolean;
  confirm: boolean;
  reopen: boolean;
  cancel: boolean;
  /** Vì sao nút chốt đang khoá dù đủ quyền và đúng trạng thái; null = chốt được. */
  confirmBlocked: ConfirmBlock | null;
}

const NONE: LoadPlanActions = {
  create: false,
  calculate: false,
  editInputs: false,
  recalculateVehicle: false,
  acknowledge: false,
  confirm: false,
  reopen: false,
  cancel: false,
  confirmBlocked: null,
};

/** Chuyến của một xe đã bắt đầu xếp hàng hoặc đã đi: BE không cho mở lại / huỷ nữa (BR-14, `LOAD_PLAN_LOADING_STARTED`). */
const LOADING_LOAD_STATUSES: ReadonlySet<string> = new Set([
  LOAD_STATUS.LOADING,
  LOAD_STATUS.DISPATCHED,
]);
const loadingStarted = (plan: PlanDetail): boolean =>
  plan.vehicles.some((vehicle) => !!vehicle.load && LOADING_LOAD_STATUSES.has(vehicle.load.status));

const allows = (from: LoadPlanStatus, to: LoadPlanStatus): boolean =>
  (LOAD_PLAN_TRANSITIONS[from] as readonly LoadPlanStatus[]).includes(to);

/**
 * Nút nào hiện cho `plan` (null = màn lập mới). Terminal state không có nút ghi nào; thiếu `:UPDATE` thì chỉ xem.
 */
export function loadPlanActions(plan: PlanDetail | null, actor: LoadPlanActor): LoadPlanActions {
  const create = actor.can(LOAD_PLAN_PERMISSIONS.create);
  if (!plan) return { ...NONE, create };
  const update = actor.can(LOAD_PLAN_PERMISSIONS.update);
  if (!update) return { ...NONE, create };
  const { status } = plan;
  const planned = status === LOAD_PLAN_STATUS.PLANNED;
  const acknowledged = !!plan.unplacedAcknowledgement;
  const needsRecalc = plan.vehicles.some((vehicle) => vehicle.needsRecalculation);
  let confirmBlocked: LoadPlanActions["confirmBlocked"] = null;
  if (plan.vehicles.length === 0) confirmBlocked = "noVehicles";
  else if (needsRecalc) confirmBlocked = "needsRecalculation";
  else if (plan.unplacedCount > 0 && !acknowledged) confirmBlocked = "unplacedPending";
  return {
    create,
    // calculate / đổi đầu vào: DRAFT hoặc PLANNED (BE `applyCalculation`, `setInputs`)
    calculate: status === LOAD_PLAN_STATUS.DRAFT || planned,
    editInputs: status === LOAD_PLAN_STATUS.DRAFT || planned,
    recalculateVehicle: planned,
    acknowledge: planned && plan.unplacedCount > 0 && !acknowledged,
    confirm: planned && allows(status, LOAD_PLAN_STATUS.CONFIRMED),
    reopen:
      status === LOAD_PLAN_STATUS.CONFIRMED &&
      allows(status, LOAD_PLAN_STATUS.PLANNED) &&
      !loadingStarted(plan),
    cancel: allows(status, LOAD_PLAN_STATUS.CANCELLED) && !loadingStarted(plan),
    confirmBlocked,
  };
}
