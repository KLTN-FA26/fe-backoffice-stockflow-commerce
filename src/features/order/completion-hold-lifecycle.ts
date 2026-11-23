/**
 * Giữ hoàn tất đơn — action-gating (WF-05 GH-2, Q-17; BE `OrderCompletionHolds.hold` @ fix/wf05-full 18d4cf88).
 *
 * - Một lần giữ đang mở mỗi đơn: chưa giữ → "Giữ hoàn tất"; đang giữ → "Gỡ giữ" (ORDER_COMPLETION_ALREADY_HELD /
 *   ORDER_COMPLETION_NOT_HELD khi trên màn đã cũ).
 * - BE nhận giữ đúng khi cả ba điều sau đều đúng, nếu không thì 409 ORDER_COMPLETION_HOLD_NOT_APPLICABLE:
 *   1. trạng thái không thuộc `PAST_COMPLETION` (COMPLETED, CLOSED, CANCELLED) — RETURNED / REFUNDED / PARTIALLY_REFUNDED
 *      VẪN giữ được: đơn ở đó còn được sửa kết quả giao (BE-46) và còn chờ đóng, Q-17 "chặn cả đóng đơn";
 *   2. đã có gì giao tới khách để xác minh: `deliveredAt` có, hoặc một lô DELIVERED;
 *   3. đơn chưa từng hoàn tất (`completedAt` trống — khiếu nại muộn trên đơn đã hoàn tất không giữ được).
 *   Trạng thái lạ (UNKNOWN) → không đoán, không mở nút.
 * - Cả hai thao tác cần `sales-order-holds:UPDATE`.
 * UI-only — Backend phải re-check (@RequiresPermission sales-order-holds:UPDATE + các mã 409 trên).
 */

import { ORDER_PERMISSIONS } from "@/constants";
import { ORDER_STATUS_UNKNOWN } from "@/constants/statuses";

import type { PermissionCode } from "@/lib/auth";
import type { CompletionHold } from "./completion-hold-schemas";
import type { Order } from "./types";

/** BE `OrderCompletionHolds.PAST_COMPLETION` (theo trạng thái FE): đơn không bao giờ tự hoàn tất / đóng nữa. */
export const PAST_COMPLETION_STATUSES: readonly Order["status"][] = [
  "Completed",
  "Closed",
  "Cancelled",
];

/** Những gì của đơn mà điều kiện giữ hoàn tất đọc. */
export type CompletionHoldGate = Pick<Order, "status" | "deliveredAt" | "completedAt"> & {
  shipments: readonly Pick<Order["shipments"][number], "status">[];
};

/** Đơn còn có thể tự hoàn tất / tự đóng và có lần giao để xác minh — BE nhận "Giữ hoàn tất". */
export function isCompletionHoldApplicable(order: CompletionHoldGate): boolean {
  if (order.status === ORDER_STATUS_UNKNOWN || PAST_COMPLETION_STATUSES.includes(order.status))
    return false;
  const delivered =
    order.deliveredAt !== null ||
    order.shipments.some((shipment) => shipment.status === "DELIVERED");
  return delivered && order.completedAt === null;
}

export type CompletionHoldActionCode = "hold" | "release";

export function allowedCompletionHoldActions(
  order: CompletionHoldGate,
  hold: Pick<CompletionHold, "releasedAt"> | null,
  can: (code: PermissionCode) => boolean,
): CompletionHoldActionCode[] {
  if (!can(ORDER_PERMISSIONS.hold)) return [];
  const open = hold !== null && hold.releasedAt === null;
  // Gỡ giữ không phụ thuộc trạng thái: lần giữ còn mở trên đơn đã đóng vẫn gỡ được (BE release chỉ kiểm có giữ hay không)
  if (open) return ["release"];
  return isCompletionHoldApplicable(order) ? ["hold"] : [];
}
