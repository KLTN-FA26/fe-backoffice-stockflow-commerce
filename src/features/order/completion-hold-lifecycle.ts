/**
 * Giữ hoàn tất đơn — action-gating (WF-05 GH-2, Q-17).
 *
 * - Một lần giữ đang mở mỗi đơn: chưa giữ → "Giữ hoàn tất"; đang giữ → "Gỡ giữ" (ORDER_COMPLETION_ALREADY_HELD /
 *   ORDER_COMPLETION_NOT_HELD khi trên màn đã cũ).
 * - "Giữ hoàn tất" chỉ khi BE nói giữ được ngay: `settlementReadiness.completionHoldable` (audit r2 lifecycle M-4; BE
 *   `Order.completionHoldable`, settlement 9e98660b — cùng luật `OrderCompletionHolds.hold` áp, false khi đang giữ). Trước
 *   đây FE chép luật của BE (trạng thái, đã giao, chưa từng hoàn tất) và lệch khi BE đổi luật (Q-17: DELIVERY_FAILED /
 *   SHIPPED có lô đã giao, RETURN_REQUESTED…). Không có khối điều kiện (chưa giao gì) hoặc cờ vắng (BE cũ) → không giữ.
 * - Cả hai thao tác cần `sales-order-holds:UPDATE`.
 * UI-only — Backend phải re-check (@RequiresPermission sales-order-holds:UPDATE, 409 ORDER_COMPLETION_HOLD_NOT_APPLICABLE).
 */

import { ORDER_PERMISSIONS } from "@/constants";

import type { PermissionCode } from "@/lib/auth";
import type { CompletionHold } from "./completion-hold-schemas";
import type { Order } from "./types";

/** Những gì của đơn mà điều kiện giữ hoàn tất đọc: chỉ cờ BE tính. */
export type CompletionHoldGate = {
  settlementReadiness: Pick<NonNullable<Order["settlementReadiness"]>, "completionHoldable"> | null;
};

/** BE nhận "Giữ hoàn tất" ngay lúc này (`settlementReadiness.completionHoldable`). */
export function isCompletionHoldApplicable(order: CompletionHoldGate): boolean {
  return order.settlementReadiness?.completionHoldable === true;
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
