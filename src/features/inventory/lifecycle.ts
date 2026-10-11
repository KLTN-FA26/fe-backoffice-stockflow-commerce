import { STOCK_ADJUSTMENT_ACTION } from "@/constants/inventory";
import { STOCK_ADJUSTMENT_STATUS } from "@/constants/statuses";

import type { StockAdjustmentStatus } from "@/constants/statuses";
import type { RoleName } from "@/lib/auth/roles";

// BR-STK-005 (backend docs/business-design/04c-all-flows.md F-CNT).
// StockAdjustment.java (SCRUM-424): approval and posting are one transaction.
export const ADJUSTMENT_TRANSITIONS = {
  [STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL]: [
    STOCK_ADJUSTMENT_STATUS.POSTED,
    STOCK_ADJUSTMENT_STATUS.REJECTED,
    STOCK_ADJUSTMENT_STATUS.WITHDRAWN,
  ],
  [STOCK_ADJUSTMENT_STATUS.POSTED]: [],
  [STOCK_ADJUSTMENT_STATUS.REJECTED]: [],
  [STOCK_ADJUSTMENT_STATUS.WITHDRAWN]: [],
} as const satisfies Record<StockAdjustmentStatus, readonly StockAdjustmentStatus[]>;

// UI-only defaults from StockOperationsController / SCRUM-424 grants.
// Backend must re-check permission, warehouse scope and four-eyes constraints.
export function canRequestAdjustment(roles: readonly RoleName[]): boolean {
  return roles.some(
    (role) => role === "Warehouse Staff" || role === "Warehouse Manager" || role === "System Admin",
  );
}

export function canViewInventory(roles: readonly RoleName[]): boolean {
  return canRequestAdjustment(roles) || roles.includes("Inventory Planner");
}

export function allowedAdjustmentActions(
  status: StockAdjustmentStatus,
  roles: readonly RoleName[],
  userId: string | undefined,
  requestedBy: string,
): Array<(typeof STOCK_ADJUSTMENT_ACTION)[keyof typeof STOCK_ADJUSTMENT_ACTION]> {
  if (status !== STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL || !userId) return [];
  if (userId === requestedBy) {
    return canRequestAdjustment(roles) ? [STOCK_ADJUSTMENT_ACTION.WITHDRAW] : [];
  }
  // StockAdjustment.approveAndPost/reject: requester cannot decide own request.
  return roles.some((role) => role === "Warehouse Manager" || role === "System Admin")
    ? [STOCK_ADJUSTMENT_ACTION.APPROVE, STOCK_ADJUSTMENT_ACTION.REJECT]
    : [];
}
