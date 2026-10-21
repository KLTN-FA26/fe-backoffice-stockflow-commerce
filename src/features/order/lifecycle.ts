/**
 * Order — lifecycle & action-gating.
 *
 * Re-exports transition table from domain/lifecycle.ts (single source of truth).
 * Adds `allowedOrderActions()` for UI action-gating per status + mã quyền BE
 * (`/identity/me/permissions`), như `allowedSupplierActions`.
 *
 * Source: BE order/api/OrderStatus.java + OrderReleaseController (PR #133; FE khớp BE — xem ORDER_STATUSES).
 */

import { ORDER_ACTION_LABELS, ORDER_MANUAL_HOLD_REASONS, ORDER_PERMISSIONS } from "@/constants";
import {
  ORDER_TRANSITIONS,
  allowedTransitions,
  canTransition,
  isTerminal,
} from "@/lib/domain/lifecycle";

import type { PermissionCode } from "@/lib/auth";
import type { Order, OrderStatus } from "./types";

/* ── Re-exports ──────────────────────────────────────────────────────── */

export { ORDER_TRANSITIONS, allowedTransitions, canTransition, isTerminal };

/* ── Action definitions ──────────────────────────────────────────────── */

/** Dữ kiện ngoài trạng thái mà BE xét khi cho / từ chối một thao tác. */
export interface OrderActionContext {
  /** Lý do đang giữ (staff); null khi không ON_HOLD. */
  readonly holdReason: Order["holdReason"];
  /** Đơn đã có lô giao: kết quả giao ghi theo từng lô, không ghi ở cấp đơn. */
  readonly hasShipments: boolean;
  /**
   * Mốc đóng gói xong lần đầu (BE `packedAt`). Đã có thì BE từ chối huỷ (`Order#requireNotPacked`,
   * ORDER_NOT_CANCELLABLE) — kể cả đơn ON_HOLD bị giữ từ PACKED / PARTIALLY_FULFILLED.
   */
  readonly packedAt: string | null;
}

const NO_CONTEXT: OrderActionContext = { holdReason: null, hasShipments: false, packedAt: null };

/** Actions the UI can gate per status + permission code (+ ngữ cảnh đơn). */
export interface OrderAction {
  /** Unique action code. */
  readonly code: OrderActionCode;
  /** Button label. */
  readonly label: string;
  /** Mã quyền BE cần có. */
  readonly permission: PermissionCode;
  /** Statuses where this action is available. */
  readonly fromStatuses: readonly OrderStatus[];
  /** Target status after action (undefined = non-transition action). */
  readonly targetStatus?: OrderStatus;
  /** Điều kiện thêm ngoài trạng thái (vd lý do giữ, đã chia lô). */
  readonly requires?: (context: OrderActionContext) => boolean;
  /** Destructive action styling. */
  readonly destructive?: boolean;
}

export type OrderActionCode =
  "admin-cancel" | "hold" | "resolve-hold" | "delivery-failure" | "remainder-closure";

/**
 * Lý do giữ mà điều phối viên gỡ tay được (`POST /orders/{id}/hold/resolution`). CREDIT đi qua duyệt
 * công nợ (`ORDER_CREDIT_HOLD_USE_APPROVAL`), DESIGN_MISMATCH qua kiểm tra lại kiện
 * (`ORDER_DESIGN_HOLD_USE_REVERIFICATION`); lý do lạ không đoán — không hiện nút.
 */
export function isManuallyResolvableHold(reason: Order["holdReason"]): boolean {
  return reason !== null && (ORDER_MANUAL_HOLD_REASONS as readonly string[]).includes(reason);
}

export const ORDER_ACTIONS: readonly OrderAction[] = [
  // BE `OrderStatus#canTransitionTo` (PR #133): → CANCELLED từ DRAFT, PENDING_PAYMENT, CONFIRMED,
  // IN_PRODUCTION, READY_TO_FULFILL, PICKING, ON_HOLD. PACKED trở đi (packedAt đã có) KHÔNG huỷ được (quyết định
  // 17/10, BR-ORD-004) — đi luồng trả hàng. Endpoint: POST /orders/{orderId}/admin-cancellation
  // (BE sales-order-cancellations:UPDATE, scope ALL).
  {
    code: "admin-cancel",
    label: "Huỷ đơn",
    permission: ORDER_PERMISSIONS.cancel,
    fromStatuses: [
      "Draft",
      "Pending Payment",
      "Confirmed",
      "In Production",
      "Ready to Fulfill",
      "Picking",
      "On Hold",
    ],
    targetStatus: "Cancelled",
    // `Order#requireNotPacked` (03 §9): đã đóng gói thì không huỷ — bất kể trạng thái hiện tại (ON_HOLD gồm cả)
    requires: ({ packedAt }) => packedAt === null,
    destructive: true,
  },
  // `OrderStatus#mayBePutOnHold`: CONFIRMED … PACKED (kể cả giao một phần). POST /orders/{id}/hold,
  // sales-orders:APPROVE. Không giữ lần hai: đơn đang ON_HOLD phải gỡ giữ trước.
  {
    code: "hold",
    label: ORDER_ACTION_LABELS.hold.button,
    permission: ORDER_PERMISSIONS.approve,
    fromStatuses: [
      "Confirmed",
      "In Production",
      "Ready to Fulfill",
      "Picking",
      "Partially Fulfilled",
      "Packed",
    ],
    targetStatus: "On Hold",
  },
  // `Order#resolveHold`: chỉ giữ do điều phối viên nêu; CREDIT / DESIGN_MISMATCH bị BE từ chối.
  // Đơn quay về `statusBeforeHold`, nên không gắn `targetStatus` đơn lẻ. POST /orders/{id}/hold/resolution.
  {
    code: "resolve-hold",
    label: ORDER_ACTION_LABELS.resolveHold.button,
    permission: ORDER_PERMISSIONS.approve,
    fromStatuses: ["On Hold"],
    requires: ({ holdReason }) => isManuallyResolvableHold(holdReason),
  },
  // `Order#markDeliveryFailed`: SHIPPED / PARTIALLY_FULFILLED → DELIVERY_FAILED; đơn đã chia lô thì
  // BE trả 409 ORDER_DELIVERY_VIA_SHIPMENT (kết quả ghi theo lô). POST /orders/{id}/delivery-failure.
  {
    code: "delivery-failure",
    label: ORDER_ACTION_LABELS.deliveryFailure.button,
    permission: ORDER_PERMISSIONS.approve,
    fromStatuses: ["Shipped", "Partially Fulfilled"],
    targetStatus: "Delivery Failed",
    requires: ({ hasShipments }) => !hasShipments,
  },
  // `Order#closeRemainder`: chỉ từ PARTIALLY_FULFILLED (đơn ON_HOLD phải gỡ giữ trước); đơn chuyển theo
  // các lô giao. POST /orders/{id}/remainder-closure, sales-order-cancellations:UPDATE.
  {
    code: "remainder-closure",
    label: ORDER_ACTION_LABELS.remainderClosure.button,
    permission: ORDER_PERMISSIONS.cancel,
    fromStatuses: ["Partially Fulfilled"],
  },
] as const;

/* ── Action gating ───────────────────────────────────────────────────── */

/**
 * Return the list of actions available for a given order status + permission checker.
 *
 * Checks:
 * 1. Action's `fromStatuses` includes current status.
 * 2. If action has `targetStatus`, the transition table allows it.
 * 3. Điều kiện thêm `requires` (lý do giữ, đã chia lô) thoả.
 * 4. Người dùng có mã quyền BE yêu cầu (`can` = `usePermissionChecker()` ở component).
 *
 * UI-only gating — Backend phải re-check (bảng chuyển trạng thái + @RequiresPermission).
 */
export function allowedOrderActions(
  status: OrderStatus,
  can: (code: PermissionCode) => boolean,
  context: OrderActionContext = NO_CONTEXT,
): readonly OrderAction[] {
  return ORDER_ACTIONS.filter((action) => {
    // 1. Status gate
    if (!action.fromStatuses.includes(status)) return false;

    // 2. Transition gate
    if (action.targetStatus && !canTransition(ORDER_TRANSITIONS, status, action.targetStatus)) {
      return false;
    }

    // 3. Context gate
    if (action.requires && !action.requires(context)) return false;

    // 4. Permission gate
    return can(action.permission);
  });
}

/** Check if the order is in a terminal (final) state. */
export function isOrderTerminal(status: OrderStatus): boolean {
  return isTerminal(ORDER_TRANSITIONS, status);
}

/** Get allowed next statuses from the transition table. */
export function nextOrderStatuses(status: OrderStatus): readonly OrderStatus[] {
  return allowedTransitions(ORDER_TRANSITIONS, status);
}
