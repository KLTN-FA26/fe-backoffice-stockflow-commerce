/**
 * Order — lifecycle & action-gating. Re-exports transition table from domain/lifecycle.ts (single source of truth)
 * và thêm `allowedOrderActions()` gate theo trạng thái + mã quyền BE (`/identity/me/permissions`).
 * Bảng thao tác nằm ở `lifecycle-actions.ts` (giới hạn 200 dòng / file).
 * Source: BE order/api/OrderStatus.java + OrderReleaseController (PR #133; FE khớp BE — xem ORDER_STATUSES).
 */

import {
  ORDER_TRANSITIONS,
  allowedTransitions,
  canTransition,
  isTerminal,
} from "@/lib/domain/lifecycle";

import { NO_CONTEXT, ORDER_ACTIONS, isManuallyResolvableHold } from "./lifecycle-actions";

import type { PermissionCode } from "@/lib/auth";
import type { OrderAction, OrderActionContext } from "./lifecycle-actions";
import type { OrderStatus } from "./types";

/* ── Re-exports ──────────────────────────────────────────────────────── */

export { ORDER_TRANSITIONS, allowedTransitions, canTransition, isTerminal };
export { ORDER_ACTIONS, isManuallyResolvableHold };
export type { OrderAction, OrderActionCode, OrderActionContext } from "./lifecycle-actions";

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
    if (action.requires && !action.requires(context, status)) return false;

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
