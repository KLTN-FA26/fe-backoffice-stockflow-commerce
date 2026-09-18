/**
 * Order — lifecycle & action-gating.
 *
 * Re-exports transition table from domain/lifecycle.ts (single source of truth).
 * Adds `allowedOrderActions()` for UI action-gating per status + role.
 *
 * Source: docs/ecommerce/17-order §5 + BE order/internal/domain/OrderStatus.java.
 */

import { can } from "@/lib/auth/permissions";
import {
  ORDER_TRANSITIONS,
  allowedTransitions,
  canTransition,
  isTerminal,
} from "@/lib/domain/lifecycle";

import type { Permission } from "@/lib/auth/permissions";
import type { RoleName } from "@/lib/auth/roles";
import type { OrderStatus } from "./types";

/* ── Re-exports ──────────────────────────────────────────────────────── */

export { ORDER_TRANSITIONS, allowedTransitions, canTransition, isTerminal };

/* ── Action definitions ──────────────────────────────────────────────── */

/** Actions the UI can gate per status + role. */
export interface OrderAction {
  /** Unique action code. */
  readonly code: string;
  /** Button label. */
  readonly label: string;
  /** Permission required. */
  readonly permission: Permission;
  /** Statuses where this action is available. */
  readonly fromStatuses: readonly OrderStatus[];
  /** Target status after action (undefined = non-transition action). */
  readonly targetStatus?: OrderStatus;
  /** Destructive action styling. */
  readonly destructive?: boolean;
}

export const ORDER_ACTIONS: readonly OrderAction[] = [
  // BR-031 (docs 17-order §5): huỷ bị chặn từ "Shipped" trở đi — hàng đã bàn giao
  // vận chuyển, phải đi qua flow trả hàng. `fromStatuses` vì vậy không chứa
  // "Shipped"/"In Transit"/"Delivered" và các state sau đó.
  // Endpoint: POST /api/v1/orders/{orderId}/admin-cancellation (scope ALL).
  {
    code: "admin-cancel",
    label: "Huỷ đơn",
    permission: "order.cancel",
    fromStatuses: ["Draft", "Pending Payment", "Confirmed", "Ready to Fulfill"],
    targetStatus: "Cancelled",
    destructive: true,
  },
] as const;

/* ── Action gating ───────────────────────────────────────────────────── */

/**
 * Return the list of actions available for a given order status + user role.
 *
 * Checks:
 * 1. Action's `fromStatuses` includes current status.
 * 2. If action has `targetStatus`, the transition table allows it.
 * 3. User's role has the required permission.
 *
 * UI-only gating — Backend phải re-check (BR-031).
 */
export function allowedOrderActions(
  status: OrderStatus,
  role: RoleName | RoleName[],
): readonly OrderAction[] {
  return ORDER_ACTIONS.filter((action) => {
    // 1. Status gate
    if (!action.fromStatuses.includes(status)) return false;

    // 2. Transition gate
    if (action.targetStatus && !canTransition(ORDER_TRANSITIONS, status, action.targetStatus)) {
      return false;
    }

    // 3. Permission gate
    return can(role, action.permission);
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
