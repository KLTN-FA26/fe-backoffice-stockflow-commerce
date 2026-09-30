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
    // BR-05 (docs 02 §6): không huỷ khi đã có receipt — PARTIALLY_RECEIVED bị loại.
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
    // BR-03 (docs 02 §6): chỉ nhận khi PO đã chốt (Confirmed ≙ BE SENT) hoặc Partially Received.
    fromStatuses: ["SENT", "PARTIALLY_RECEIVED"],
  },
] as const;

/* ── Action gating ───────────────────────────────────────────────────── */

/**
 * Actions available for a PO status + the user's roles (all of them — a user may hold
 * several roles, and `can()` grants if ANY role has the permission).
 *
 * 1. Action's `fromStatuses` includes the current status.
 * 2. If the action has a `targetStatus`, `PO_TRANSITIONS` allows it.
 * 3. One of the roles has the required permission.
 *
 * `status` is always one of the 7 BE values: the API layer zod-parses every response and
 * the mock adapter speaks the BE vocabulary, so no normalisation is needed here.
 * UI-only gate — backend re-checks permission (@RequiresPermission) and transition (409).
 */
export function allowedPoActions(
  status: PoStatus,
  roles: readonly RoleName[],
): readonly PoAction[] {
  return PO_ACTIONS.filter((action) => {
    const allowedByTable =
      !action.targetStatus || canTransition(PO_TRANSITIONS, status, action.targetStatus);
    return (
      action.fromStatuses.includes(status) && allowedByTable && can([...roles], action.permission)
    );
  });
}

/** True when the PO has no outgoing transition (CLOSED / CLOSED_SHORT / CANCELLED). */
export function isPoTerminal(status: PoStatus): boolean {
  return isTerminal(PO_TRANSITIONS, status);
}

/** Statuses reachable in one step from `status`. */
export function nextPoStatuses(status: PoStatus): readonly PoStatus[] {
  return allowedTransitions(PO_TRANSITIONS, status);
}
