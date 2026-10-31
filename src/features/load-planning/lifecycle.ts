/**
 * Quyền thao tác trên kế hoạch xếp xe — mã quyền từ `/identity/me/permissions`, không theo tên vai trò.
 * Bảng chuyển trạng thái chép từ docs 09 §5 và `LoadPlan.requireStatus` của BE (PR #161):
 * DRAFT → PLANNED (tính) → CONFIRMED (chốt) → DISPATCHED (PR E, BE tự chuyển); DRAFT/PLANNED/CONFIRMED → CANCELLED;
 * CONFIRMED → PLANNED (mở lại, BR-14); đổi đầu vào đưa PLANNED về DRAFT. UI-only — Backend phải re-check
 * (`fulfillment-load-plans:CREATE` trên POST, `:UPDATE` trên mọi bước sau; BR-13, BR-14, LP-4). Sau khi đã bắt đầu xếp hàng
 * chỉ còn huỷ có kiểm soát (CONFIRMED → CANCELLED, SCRUM-474) bằng `fulfillment-controlled-cancellations:UPDATE`.
 */

import {
  FULFILLMENT_CONTROLLED_CANCELLATION_PERMISSIONS,
  LOAD_PLAN_PERMISSIONS,
  LOAD_PLAN_STATUS,
  LOAD_STATUS,
} from "@/constants";

import type { LoadPlanStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth";
import { isTransferPlan } from "./plan-selectors";

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

/** `transferShipsWhole`: lệnh chuyển kho đi nguyên (BE PR #164 `TRANSFER_SHIPS_WHOLE`) — còn kiện chưa xếp thì chưa chốt được. */
export type ConfirmBlock =
  "noVehicles" | "needsRecalculation" | "transferShipsWhole" | "unplacedPending";

export interface LoadPlanActions {
  create: boolean;
  calculate: boolean;
  editInputs: boolean;
  recalculateVehicle: boolean;
  /** Chỉnh xếp tay `PUT …/placements` (BE `LoadPlan.editPlacements`: chỉ khi PLANNED, và phải còn xe để đặt). */
  editPlacements: boolean;
  acknowledge: boolean;
  confirm: boolean;
  reopen: boolean;
  cancel: boolean;
  /**
   * Huỷ có kiểm soát cả kế hoạch SAU KHI đã bắt đầu xếp hàng (SCRUM-474 UNLOAD-DESIGN, docs 09 BR-14): mã quyền riêng
   * `fulfillment-controlled-cancellations:UPDATE` (quản lý kho), kế hoạch CONFIRMED mà huỷ thường không còn dùng được.
   */
  cancelControlled: boolean;
  /** `vehicleLeft`: đã có xe rời kho → BE 409 LOAD_PLAN_VEHICLE_DISPATCHED, chỉ huỷ được từng xe (điểm 3). */
  cancelControlledBlocked: "vehicleLeft" | null;
  /** Vì sao nút chốt đang khoá dù đủ quyền và đúng trạng thái; null = chốt được. */
  confirmBlocked: ConfirmBlock | null;
}

const NONE: LoadPlanActions = {
  create: false,
  calculate: false,
  editInputs: false,
  recalculateVehicle: false,
  editPlacements: false,
  acknowledge: false,
  confirm: false,
  reopen: false,
  cancel: false,
  cancelControlled: false,
  cancelControlledBlocked: null,
  confirmBlocked: null,
};

/** Chuyến của một xe đã bắt đầu xếp hàng hoặc đã đi: BE không cho mở lại / huỷ nữa (BR-14, `LOAD_PLAN_LOADING_STARTED`). */
const LOADING_LOAD_STATUSES: ReadonlySet<string> = new Set([
  LOAD_STATUS.LOADING,
  LOAD_STATUS.DISPATCHED,
]);
const loadingStarted = (plan: PlanDetail): boolean =>
  plan.vehicles.some((vehicle) => !!vehicle.load && LOADING_LOAD_STATUSES.has(vehicle.load.status));

/** Có xe đã rời kho (DISPATCHED): không huỷ cả kế hoạch được nữa (UNLOAD-DESIGN điểm 3). */
const vehicleLeft = (plan: PlanDetail): boolean =>
  plan.vehicles.some((vehicle) => vehicle.load?.status === LOAD_STATUS.DISPATCHED);

const allows = (from: LoadPlanStatus, to: LoadPlanStatus): boolean =>
  (LOAD_PLAN_TRANSITIONS[from] as readonly LoadPlanStatus[]).includes(to);

/**
 * Nút nào hiện cho `plan` (null = màn lập mới). Terminal state không có nút ghi nào; thiếu `:UPDATE` thì chỉ xem.
 */
export function loadPlanActions(plan: PlanDetail | null, actor: LoadPlanActor): LoadPlanActions {
  const create = actor.can(LOAD_PLAN_PERMISSIONS.create);
  if (!plan) return { ...NONE, create };
  // Quyền riêng của quản lý kho, độc lập với `:UPDATE`; chỉ hiện khi huỷ thường bị BR-14 chặn (đã xếp hàng / đã có xe đi).
  // Backend phải re-check (BR-14).
  const cancelControlled =
    actor.can(FULFILLMENT_CONTROLLED_CANCELLATION_PERMISSIONS.update) &&
    plan.status === LOAD_PLAN_STATUS.CONFIRMED &&
    loadingStarted(plan);
  const cancelControlledBlocked = cancelControlled && vehicleLeft(plan) ? "vehicleLeft" : null;
  const update = actor.can(LOAD_PLAN_PERMISSIONS.update);
  if (!update) return { ...NONE, create, cancelControlled, cancelControlledBlocked };
  const { status } = plan;
  const planned = status === LOAD_PLAN_STATUS.PLANNED;
  const acknowledged = !!plan.unplacedAcknowledgement;
  // BE `requireTransferWhole`: kế hoạch chuyển kho không để lại kiện nào — không có "để lại" để xác nhận
  const transfer = isTransferPlan(plan);
  const needsRecalc = plan.vehicles.some((vehicle) => vehicle.needsRecalculation);
  let confirmBlocked: LoadPlanActions["confirmBlocked"] = null;
  if (plan.vehicles.length === 0) confirmBlocked = "noVehicles";
  else if (needsRecalc) confirmBlocked = "needsRecalculation";
  else if (plan.unplacedCount > 0 && transfer) confirmBlocked = "transferShipsWhole";
  else if (plan.unplacedCount > 0 && !acknowledged) confirmBlocked = "unplacedPending";
  return {
    create,
    // calculate / đổi đầu vào: DRAFT hoặc PLANNED (BE `applyCalculation`, `setInputs`)
    calculate: status === LOAD_PLAN_STATUS.DRAFT || planned,
    editInputs: status === LOAD_PLAN_STATUS.DRAFT || planned,
    recalculateVehicle: planned,
    editPlacements: planned && plan.vehicles.length > 0,
    acknowledge: planned && plan.unplacedCount > 0 && !acknowledged && !transfer,
    confirm: planned && allows(status, LOAD_PLAN_STATUS.CONFIRMED),
    reopen:
      status === LOAD_PLAN_STATUS.CONFIRMED &&
      allows(status, LOAD_PLAN_STATUS.PLANNED) &&
      !loadingStarted(plan),
    cancel: allows(status, LOAD_PLAN_STATUS.CANCELLED) && !loadingStarted(plan),
    cancelControlled,
    cancelControlledBlocked,
    confirmBlocked,
  };
}
