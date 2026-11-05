/**
 * Order — lifecycle & action-gating. Re-exports transition table from domain/lifecycle.ts (single source of truth)
 * và thêm `allowedOrderActions()` gate theo trạng thái + mã quyền BE (`/identity/me/permissions`) + ngữ cảnh đơn,
 * như `allowedSupplierActions`. Bảng thao tác nằm ở `lifecycle-actions.ts` (giới hạn 200 dòng / file).
 *
 * Source: BE order/api/OrderStatus.java, Order.java (PR #133), OrderReleaseService (SCRUM-423),
 * CreditHoldService (SCRUM-427) — FE khớp BE, xem ORDER_STATUSES.
 */

import { ORDER_STATUS_UNKNOWN } from "@/constants";
import {
  ORDER_TRANSITIONS,
  allowedTransitions,
  canTransition,
  isTerminal,
} from "@/lib/domain/lifecycle";

import {
  ORDER_ACTIONS,
  UNKNOWN_CONTEXT,
  isCreditHold,
  isManuallyResolvableHold,
} from "./lifecycle-actions";

import type { PermissionCode } from "@/lib/auth";
import type { OrderAction, OrderActionContext, OrderActionOutcome } from "./lifecycle-actions";
import type { Order, OrderReadStatus, OrderStatus } from "./types";

/* ── Re-exports ──────────────────────────────────────────────────────── */

export { ORDER_TRANSITIONS, allowedTransitions, canTransition, isTerminal };
export { ORDER_ACTIONS, UNKNOWN_CONTEXT, isCreditHold, isManuallyResolvableHold };
export type {
  OrderAction,
  OrderActionCode,
  OrderActionContext,
  OrderActionOutcome,
} from "./lifecycle-actions";

/** Các đích tĩnh của action phải là cạnh hợp lệ từ `status` (khôi phục trạng thái cũ: BE tự chọn). */
function outcomeAllowed(outcome: OrderActionOutcome, status: OrderStatus): boolean {
  switch (outcome.kind) {
    case "to":
      return outcome.statuses.every((target) => canTransition(ORDER_TRANSITIONS, status, target));
    case "follow-shipments":
      return outcome.possible.every((target) => canTransition(ORDER_TRANSITIONS, status, target));
    case "restore-before-hold":
      return true;
  }
}

/* ── Action gating ───────────────────────────────────────────────────── */

/**
 * Return the list of actions available for a given order status + permission checker + ngữ cảnh.
 *
 * Checks:
 * 1. Action's `fromStatuses` includes current status.
 * 2. Các đích tĩnh của action hợp lệ theo bảng chuyển tiếp (`outcomeAllowed`).
 * 3. Điều kiện thêm (`requires`) trên `context` — lý do giữ, đã chia lô, đã đóng gói, giữ công nợ.
 * 4. Người dùng có mã quyền BE yêu cầu (`can` = `usePermissionChecker()` ở component).
 * `UNKNOWN` (trạng thái BE FE chưa hỗ trợ) → không action nào.
 *
 * UI-only gating — Backend phải re-check (bảng chuyển trạng thái, Order#requireNotPacked,
 * OrderReleaseService, CreditHoldService + @RequiresPermission; docs 17 BR-02/BR-03).
 */
export function allowedOrderActions(
  status: OrderReadStatus,
  can: (code: PermissionCode) => boolean,
  context: OrderActionContext = UNKNOWN_CONTEXT,
): readonly OrderAction[] {
  if (status === ORDER_STATUS_UNKNOWN) return [];
  return ORDER_ACTIONS.filter((action) => {
    // 1. Status gate
    if (!action.fromStatuses.includes(status)) return false;
    // 2. Transition gate
    if (!outcomeAllowed(action.outcome, status)) return false;
    // 3. Context gate
    if (action.requires && !action.requires(context, status)) return false;
    // 4. Permission gate
    return can(action.permission);
  });
}

/** Ngữ cảnh action dựng từ đơn chi tiết (`GET /orders/{id}`) — mọi field BE đã trả hoặc chuẩn hoá null. */
export function orderActionContextOf(
  order: Pick<Order, "paymentTerm" | "holdReason" | "shipments" | "packedAt" | "statusBeforeHold">,
): OrderActionContext {
  return {
    paymentTerm: order.paymentTerm,
    holdReason: order.holdReason,
    hasShipments: order.shipments.length > 0,
    packedAt: order.packedAt,
    statusBeforeHold: order.statusBeforeHold,
  };
}

/**
 * Check if the order is in a terminal (final) state. `UNKNOWN` không có chuyển tiếp nhưng KHÔNG
 * phải đã kết thúc — chỉ là FE chưa hiểu trạng thái đó.
 */
export function isOrderTerminal(status: OrderReadStatus): boolean {
  return status !== ORDER_STATUS_UNKNOWN && isTerminal(ORDER_TRANSITIONS, status);
}

/** Get allowed next statuses from the transition table — luôn là trạng thái đã biết, không bao giờ UNKNOWN. */
export function nextOrderStatuses(status: OrderReadStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[status];
}
