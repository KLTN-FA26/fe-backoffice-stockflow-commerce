/**
 * Purchase Order — lifecycle & action-gating.
 *
 * Re-exports transition table from domain/lifecycle.ts (single source of truth).
 * Adds `allowedPoActions()` for UI action-gating per status + role.
 *
 * Source: BE PurchaseOrderStatus.java + PurchaseOrder aggregate (7-state).
 * Full 10-state is docs/warehouse/02-purchase-order §5; BE deliberately narrows
 * (SCRUM-113/116) — FE mirrors BE so permissions gate correctly.
 */

import {
  PO_TRANSITIONS,
  canTransition,
  isTerminal,
  allowedTransitions,
} from "@/lib/domain/lifecycle";
import { can } from "@/lib/auth/permissions";

import type { PoStatus } from "./types";
import type { RoleName } from "@/lib/auth/roles";
import type { Permission } from "@/lib/auth/permissions";

/* ── Re-exports ──────────────────────────────────────────────────────── */

export { PO_TRANSITIONS, canTransition, isTerminal, allowedTransitions };

/* ── Action definitions ──────────────────────────────────────────────── */

/** Actions the UI can gate per status + role. */
export interface PoAction {
  /** Unique action code. */
  readonly code: string;
  /** Button label. */
  readonly label: string;
  /** Permission required. */
  readonly permission: Permission;
  /** Statuses where this action is available. */
  readonly fromStatuses: readonly PoStatus[];
  /** Target status after action (undefined = non-transition action like "edit"). */
  readonly targetStatus?: PoStatus;
  /** Destructive action styling. */
  readonly destructive?: boolean;
  /** Whether reason is required (BE cancel/closeShort need {reason}). */
  readonly requiresReason?: boolean;
}

/**
 * PO actions — one entry per BE endpoint (PurchaseOrderController.java).
 * - approve:    DRAFT -> APPROVED   (permission po.approve)
 * - send:       APPROVED -> SENT    (permission po.update — see ticket note on sends)
 * - cancel:     DRAFT/APPROVED/SENT -> CANCELLED, needs reason (po.update)
 * - closeShort: PARTIALLY_RECEIVED -> CLOSED_SHORT, needs reason
 * - receive:    SENT/PARTIALLY_RECEIVED -> PARTIALLY_RECEIVED|CLOSED (not via canTransitionTo)
 *
 * Removed vs old docs 10-state: submit/submit-auto-approve/pendingApproval,
 * approve->Draft rejection, confirm/close/force-close variants that BE dropped.
 */
export const PO_ACTIONS: readonly PoAction[] = [
  {
    code: "edit",
    label: "Chỉnh sửa",
    permission: "po.create",
    fromStatuses: ["DRAFT"],
  },
  {
    code: "approve",
    label: "Phê duyệt",
    permission: "po.approve",
    fromStatuses: ["DRAFT"],
    targetStatus: "APPROVED",
  },
  {
    code: "send",
    label: "Gửi NCC",
    permission: "po.update",
    fromStatuses: ["APPROVED"],
    targetStatus: "SENT",
  },
  {
    code: "cancel",
    label: "Huỷ PO",
    permission: "po.update",
    fromStatuses: ["DRAFT", "APPROVED", "SENT"],
    targetStatus: "CANCELLED",
    destructive: true,
    requiresReason: true,
  },
  {
    code: "closeShort",
    label: "Đóng thiếu",
    permission: "po.update",
    fromStatuses: ["PARTIALLY_RECEIVED"],
    targetStatus: "CLOSED_SHORT",
    destructive: true,
    requiresReason: true,
  },
  {
    code: "receive",
    label: "Nhận hàng",
    permission: "po.update",
    fromStatuses: ["SENT", "PARTIALLY_RECEIVED"],
  },
] as const;

/* ── Action gating ───────────────────────────────────────────────────── */

/**
 * Return the list of actions available for a given PO status + user role.
 *
 * Checks:
 * 1. Action's `fromStatuses` includes current status.
 * 2. If action has `targetStatus`, the transition table allows it.
 * 3. User's role has the required permission.
 */
export function allowedPoActions(status: PoStatus, role: RoleName): readonly PoAction[] {
  return PO_ACTIONS.filter((action) => {
    if (!action.fromStatuses.includes(status)) return false;
    if (action.targetStatus && !canTransition(PO_TRANSITIONS, status, action.targetStatus)) {
      return false;
    }
    return can(role, action.permission);
  });
}

export function isPoTerminal(status: PoStatus): boolean {
  return isTerminal(PO_TRANSITIONS, status);
}

export function nextPoStatuses(status: PoStatus): readonly PoStatus[] {
  return allowedTransitions(PO_TRANSITIONS, status);
}
