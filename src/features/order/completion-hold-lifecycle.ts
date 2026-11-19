/**
 * Giữ hoàn tất đơn — action-gating (WF-05 GH-2; BE `OrderCompletionHolds`).
 *
 * - Một lần giữ đang mở mỗi đơn: chưa giữ → "Giữ hoàn tất"; đang giữ → "Gỡ giữ" (ORDER_COMPLETION_ALREADY_HELD /
 *   ORDER_COMPLETION_NOT_HELD khi trên màn đã cũ).
 * - Đơn đã qua hoàn tất (BE `PAST_COMPLETION`: COMPLETED, CLOSED, CANCELLED, RETURNED, REFUNDED, PARTIALLY_REFUNDED) không
 *   giữ được (ORDER_COMPLETION_HOLD_NOT_APPLICABLE). Trạng thái lạ (UNKNOWN) → không đoán, không mở nút.
 * - Cả hai thao tác cần `sales-order-holds:UPDATE`.
 * UI-only — Backend phải re-check (@RequiresPermission sales-order-holds:UPDATE + các mã 409 trên).
 */

import { ORDER_PERMISSIONS } from "@/constants";
import { ORDER_STATUS_UNKNOWN } from "@/constants/statuses";

import type { PermissionCode } from "@/lib/auth";
import type { CompletionHold } from "./completion-hold-schemas";
import type { OrderReadStatus } from "./types";

/** BE `OrderCompletionHolds.PAST_COMPLETION` (theo trạng thái FE): đơn không bao giờ tự hoàn tất nữa. */
export const PAST_COMPLETION_STATUSES: readonly OrderReadStatus[] = [
  "Completed",
  "Closed",
  "Cancelled",
  "Returned",
  "Refunded",
  "Partially Refunded",
];

/** Đơn còn có thể tự hoàn tất — nghĩa là còn có gì để giữ. */
export function isCompletionHoldApplicable(status: OrderReadStatus): boolean {
  return status !== ORDER_STATUS_UNKNOWN && !PAST_COMPLETION_STATUSES.includes(status);
}

export type CompletionHoldActionCode = "hold" | "release";

export function allowedCompletionHoldActions(
  status: OrderReadStatus,
  hold: Pick<CompletionHold, "releasedAt"> | null,
  can: (code: PermissionCode) => boolean,
): CompletionHoldActionCode[] {
  if (!can(ORDER_PERMISSIONS.hold)) return [];
  const open = hold !== null && hold.releasedAt === null;
  // Gỡ giữ không phụ thuộc trạng thái: lần giữ còn mở trên đơn đã đóng vẫn gỡ được (BE release chỉ kiểm có giữ hay không)
  if (open) return ["release"];
  return isCompletionHoldApplicable(status) ? ["hold"] : [];
}
