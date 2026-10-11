/**
 * Order — lifecycle & action-gating.
 *
 * Re-exports transition table from domain/lifecycle.ts (single source of truth).
 * Adds `allowedOrderActions()` for UI action-gating per status + mã quyền BE
 * (`/identity/me/permissions`), như `allowedSupplierActions`.
 *
 * Source: BE order/api/OrderStatus.java (FE khớp BE — xem ORDER_STATUSES).
 */

import { CREDIT_HOLD_PERMISSIONS, ORDER_PERMISSIONS } from "@/constants";
import {
  ORDER_TRANSITIONS,
  allowedTransitions,
  canTransition,
  isTerminal,
} from "@/lib/domain/lifecycle";

import type { OrderPaymentTerm } from "@/constants";
import type { PermissionCode } from "@/lib/auth";
import type { OrderStatus } from "./types";

/* ── Re-exports ──────────────────────────────────────────────────────── */

export { ORDER_TRANSITIONS, allowedTransitions, canTransition, isTerminal };

/* ── Action definitions ──────────────────────────────────────────────── */

/** Dữ kiện đơn ngoài trạng thái mà một số action cần (vd đơn công nợ). */
export interface OrderActionContext {
  readonly paymentTerm?: OrderPaymentTerm | null;
}

export type OrderActionCode = "release" | "credit-approve" | "credit-reject" | "admin-cancel";

/** Actions the UI can gate per status + permission code. */
export interface OrderAction {
  /** Unique action code. */
  readonly code: OrderActionCode;
  /** Button label (động từ). */
  readonly label: string;
  /** Mã quyền BE cần có. */
  readonly permission: PermissionCode;
  /** Statuses where this action is available. */
  readonly fromStatuses: readonly OrderStatus[];
  /** Target statuses after action — mọi đích phải hợp lệ theo ORDER_TRANSITIONS. */
  readonly targetStatuses: readonly OrderStatus[];
  /** Điều kiện thêm ngoài trạng thái. */
  readonly requires?: (ctx: OrderActionContext) => boolean;
  /** Destructive action styling. */
  readonly destructive?: boolean;
}

// BE Order#holdForCredit / CreditHoldService: chỉ đơn ON_HOLD với paymentTerm CREDIT mới có
// hồ sơ vượt hạn mức (ON_HOLD còn dùng cho treo thiết kế, thiếu hàng…).
const isCreditOrder = (ctx: OrderActionContext) => ctx.paymentTerm === "CREDIT";

export const ORDER_ACTIONS: readonly OrderAction[] = [
  // SCRUM-423 / docs 17 §4.2 bước 4–6 + BR-02: chỉ đơn Confirmed (đủ điều kiện thanh toán) mới
  // release; có dòng in → In Production, chỉ hàng sẵn → Ready to Fulfill.
  // Endpoint: POST /orders/{id}/release (BE sales-orders:APPROVE — chỉ ORDER_COORDINATOR).
  {
    code: "release",
    label: "Release đơn",
    permission: ORDER_PERMISSIONS.release,
    fromStatuses: ["Confirmed"],
    targetStatuses: ["In Production", "Ready to Fulfill"],
  },
  // SCRUM-427 / docs 14 BR-06: đơn công nợ vượt hạn mức chờ người có quyền duyệt.
  // POST /orders/{id}/credit-approval (sales-order-credit-holds:APPROVE — ACCOUNTANT).
  {
    code: "credit-approve",
    label: "Duyệt vượt hạn mức",
    permission: CREDIT_HOLD_PERMISSIONS.approve,
    fromStatuses: ["On Hold"],
    targetStatuses: ["Confirmed"],
    requires: isCreditOrder,
  },
  // docs 15 §4.3: từ chối → huỷ, hoặc chuyển sang trả trước / đặt cọc (về Pending Payment).
  {
    code: "credit-reject",
    label: "Từ chối vượt hạn mức",
    permission: CREDIT_HOLD_PERMISSIONS.approve,
    fromStatuses: ["On Hold"],
    targetStatuses: ["Cancelled", "Pending Payment"],
    requires: isCreditOrder,
    destructive: true,
  },
  // BE BR-031 (order/api/OrderStatus.java#canTransitionTo); docs 17 BR-03 (§6 / §4.5):
  // từ "Shipped" trở đi hàng đã bàn giao vận chuyển, phải đi qua flow trả hàng. `fromStatuses`
  // = các trạng thái BE cho → CANCELLED.
  // Endpoint: POST /orders/{orderId}/admin-cancellation (BE sales-order-cancellations:UPDATE).
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
      "In Fulfilment",
      "On Hold",
    ],
    targetStatuses: ["Cancelled"],
    destructive: true,
  },
] as const;

/* ── Action gating ───────────────────────────────────────────────────── */

/**
 * Return the list of actions available for a given order status + permission checker.
 *
 * Checks:
 * 1. Action's `fromStatuses` includes current status.
 * 2. Mọi `targetStatuses` hợp lệ theo bảng chuyển tiếp.
 * 3. Điều kiện thêm (`requires`) trên `context` — vd đơn công nợ cho credit hold.
 * 4. Người dùng có mã quyền BE yêu cầu (`can` = `usePermissionChecker()` ở component).
 *
 * UI-only gating — Backend phải re-check (BE BR-031, OrderReleaseService, CreditHoldService +
 * @RequiresPermission; docs 17 BR-02/BR-03).
 */
export function allowedOrderActions(
  status: OrderStatus,
  can: (code: PermissionCode) => boolean,
  context: OrderActionContext = {},
): readonly OrderAction[] {
  return ORDER_ACTIONS.filter((action) => {
    // 1. Status gate
    if (!action.fromStatuses.includes(status)) return false;

    // 2. Transition gate — mọi đích của action phải hợp lệ theo bảng chuyển tiếp
    if (
      !action.targetStatuses.every((target) => canTransition(ORDER_TRANSITIONS, status, target))
    ) {
      return false;
    }

    // 3. Điều kiện ngoài trạng thái (vd đơn công nợ)
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
