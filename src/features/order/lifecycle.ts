/**
 * Order — lifecycle & action-gating.
 *
 * Re-exports transition table from domain/lifecycle.ts (single source of truth).
 * Adds `allowedOrderActions()` for UI action-gating per status + mã quyền BE
 * (`/identity/me/permissions`), như `allowedSupplierActions`.
 *
 * Source: BE order/api/OrderStatus.java (FE khớp BE — xem ORDER_STATUSES).
 */

import { ORDER_PERMISSIONS } from "@/constants";
import {
  ORDER_TRANSITIONS,
  allowedTransitions,
  canTransition,
  isTerminal,
} from "@/lib/domain/lifecycle";

import type { PermissionCode } from "@/lib/auth";
import type { OrderStatus } from "./types";

/* ── Re-exports ──────────────────────────────────────────────────────── */

export { ORDER_TRANSITIONS, allowedTransitions, canTransition, isTerminal };

/* ── Action definitions ──────────────────────────────────────────────── */

/** Actions the UI can gate per status + permission code. */
export interface OrderAction {
  /** Unique action code. */
  readonly code: string;
  /** Button label. */
  readonly label: string;
  /** Mã quyền BE cần có. */
  readonly permission: PermissionCode;
  /** Statuses where this action is available. */
  readonly fromStatuses: readonly OrderStatus[];
  /** Target status after action (undefined = non-transition action). */
  readonly targetStatus?: OrderStatus;
  /** Destructive action styling. */
  readonly destructive?: boolean;
}

export const ORDER_ACTIONS: readonly OrderAction[] = [
  // BE BR-031 (order/api/OrderStatus.java#canTransitionTo); docs 17 BR-03 (§6 / §4.5):
  // từ "Shipped" trở đi hàng đã bàn giao vận chuyển, phải đi qua flow trả hàng. `fromStatuses`
  // = các trạng thái BE cho → CANCELLED (DRAFT, PENDING_PAYMENT, PAID, IN_FULFILMENT, ON_HOLD).
  // Endpoint: POST /orders/{orderId}/admin-cancellation (BE sales-orders:APPROVE, scope ALL).
  {
    code: "admin-cancel",
    label: "Huỷ đơn",
    permission: ORDER_PERMISSIONS.cancel,
    fromStatuses: ["Draft", "Pending Payment", "Paid", "In Fulfilment", "On Hold"],
    targetStatus: "Cancelled",
    destructive: true,
  },
] as const;

/* ── Action gating ───────────────────────────────────────────────────── */

/**
 * Return the list of actions available for a given order status + permission checker.
 *
 * Checks:
 * 1. Action's `fromStatuses` includes current status.
 * 2. If action has `targetStatus`, the transition table allows it.
 * 3. Người dùng có mã quyền BE yêu cầu (`can` = `usePermissionChecker()` ở component).
 *
 * UI-only gating — Backend phải re-check (BE BR-031 + @RequiresPermission APPROVE/ALL; docs BR-03).
 */
export function allowedOrderActions(
  status: OrderStatus,
  can: (code: PermissionCode) => boolean,
): readonly OrderAction[] {
  return ORDER_ACTIONS.filter((action) => {
    // 1. Status gate
    if (!action.fromStatuses.includes(status)) return false;

    // 2. Transition gate
    if (action.targetStatus && !canTransition(ORDER_TRANSITIONS, status, action.targetStatus)) {
      return false;
    }

    // 3. Permission gate
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
