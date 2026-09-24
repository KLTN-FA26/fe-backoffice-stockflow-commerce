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
/**
 * Return the list of actions available for a given PO status + user role.
 *
 * **Normalize trước khi gate:** `status` có thể là Title Case legacy từ mock
 * (`MockPurchaseOrder.status = "Draft" | "Confirmed" | ...` trong
 * `src/lib/mock-data.ts`) hoặc SCREAMING_SNAKE từ BE (`PoStatus = "DRAFT" |
 * "SENT" | ...` trong `src/constants/statuses.ts`). `PO_ACTIONS.fromStatuses`
 * và `PO_TRANSITIONS` chỉ chứa key BE, nên phải normalize về BE trước khi
 * `includes()` / `canTransition()`, nếu không action sẽ bị ẩn sai hoặc crash
 * ở tầng dưới (đã từng gây `isTerminal(undefined.length)` ở detail).
 *
 * Checks:
 * 1. Action's `fromStatuses` includes normalized status.
 * 2. If action has `targetStatus`, the transition table allows it.
 * 3. User's role has the required permission.
 */
export function allowedPoActions(status: PoStatus, role: RoleName): readonly PoAction[] {
  const normalized = normalizePoStatus(status);
  return PO_ACTIONS.filter((action) => {
    if (!action.fromStatuses.includes(normalized)) return false;
    if (action.targetStatus && !canTransition(PO_TRANSITIONS, normalized, action.targetStatus)) {
      return false;
    }
    return can(role, action.permission);
  });
}

/**
 * PO có đang ở trạng thái kết thúc (không còn transition) không.
 *
 * Delegate qua `isTerminal()` nhưng phải normalize trước vì lý do dual-source
 * như trên. Nếu không normalize, `isTerminal(PO_TRANSITIONS, "Draft")` sẽ tra
 * `table["Draft"] === undefined` và (trước fix) crash `undefined.length`.
 * Sau fix `isTerminal` đã guard `undefined → true`, nhưng vẫn cần normalize
 * để `"Draft"` được tính đúng là `"DRAFT"` (non-terminal) thay vì terminal giả.
 */
export function isPoTerminal(status: PoStatus): boolean {
  return isTerminal(PO_TRANSITIONS, normalizePoStatus(status));
}

/**
 * Các trạng thái kề tiếp được phép từ `status` (dùng cho gợi ý/validate).
 *
 * Normalize tương tự `isPoTerminal` — nếu `status` là Title Case thì
 * `allowedTransitions(PO_TRANSITIONS, "Draft")` sẽ ra `[]` sai, nên phải
 * đổi về `"DRAFT"` trước.
 */
export function nextPoStatuses(status: PoStatus): readonly PoStatus[] {
  return allowedTransitions(PO_TRANSITIONS, normalizePoStatus(status));
}

/**
 * Chuẩn hóa status PO về canonical BE (SCREAMING_SNAKE).
 *
 * **Tại sao cần:** FE tồn tại 2 hệ status song song:
 * - Mock seed `src/lib/mock-data.ts: PoStatus = "Draft" | "Approved" | "Confirmed"
 *   | "Partially Received" | "Received" | ...` — giữ nguyên để không sửa mock-data
 *   (hook `guard-protected-files.mjs` chặn).
 * - BE contract `PurchaseOrderStatus.java` + `src/constants/statuses.ts`:
 *   `PoStatus = "DRAFT" | "APPROVED" | "SENT" | "PARTIALLY_RECEIVED" | "CLOSED" | ...`
 *   Đây là canonical type mà `features/purchase-order/types.ts` re-export.
 *
 * `PurchaseOrder = Omit<MockPurchaseOrder,"status"> & {status: BEPoStatus}` đã ép
 * type, nhưng runtime mock-adapter vẫn trả về Title Case. Nếu không normalize,
 * `isPoTerminal("Draft")` / `allowedPoActions("Confirmed", role)` sẽ sai.
 *
 * **Cách làm:** thử `status` nguyên văn trước (đã là BE thì giữ), rồi `toUpperCase +
 * replace space/- → _`, rồi tra `legacyMap` cho các trường hợp BE đã đổi tên
 * semantics (ví dụ mock `Confirmed` ≈ BE `SENT`, mock `Received` ≈ BE `CLOSED`,
 * theo BE narrowed 7-state SCRUM-113/116). Unknown giữ nguyên `upper` — tầng dưới
 * `isTerminal` đã guard `undefined → true` nên không crash.
 */
function normalizePoStatus(status: string): PoStatus {
  if ((status as string) in PO_TRANSITIONS) return status as PoStatus;
  const upper = status.toUpperCase().replace(/[\s-]+/g, "_");
  if ((upper as string) in PO_TRANSITIONS) return upper as PoStatus;
  // Map legacy gaps: mock "Confirmed" ≈ SENT (BE narrowed Received semantics),
  // "Received" ≈ CLOSED. Unknown → treat as-is (isTerminal will guard).
  const legacyMap: Record<string, PoStatus> = {
    CONFIRMED: "SENT",
    RECEIVED: "CLOSED",
    PENDING_APPROVAL: "APPROVED",
  };
  return (legacyMap[upper] as PoStatus | undefined) ?? (upper as PoStatus);
}
