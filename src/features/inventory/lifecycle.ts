import { STOCK_ADJUSTMENT_ACTION } from "@/constants/inventory";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";
import { STOCK_ADJUSTMENT_STATUS } from "@/constants/statuses";

import type { StockAdjustmentStatus } from "@/constants/statuses";
import type { PermissionCode } from "@/lib/auth";

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

// `status` is the open response string: anything other than a known pending
// request — including an unrecognised backend status — offers no action.
// Lifecycle + actor decide eligibility; `can` (usePermissionChecker) decides the
// server-granted capability. UI-only — StockOperationsController re-checks both.
export function allowedAdjustmentActions(
  status: string,
  can: (code: PermissionCode) => boolean,
  userId: string | undefined,
  requestedBy: string,
): Array<(typeof STOCK_ADJUSTMENT_ACTION)[keyof typeof STOCK_ADJUSTMENT_ACTION]> {
  if (status !== STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL || !userId) return [];
  // StockAdjustment.withdraw: only the requester, while pending.
  if (userId === requestedBy) {
    return can(INVENTORY_PERMISSIONS.stockUpdate) ? [STOCK_ADJUSTMENT_ACTION.WITHDRAW] : [];
  }
  // StockAdjustment.approveAndPost/reject: requester cannot decide own request.
  return can(INVENTORY_PERMISSIONS.adjustmentApprove)
    ? [STOCK_ADJUSTMENT_ACTION.APPROVE, STOCK_ADJUSTMENT_ACTION.REJECT]
    : [];
}
