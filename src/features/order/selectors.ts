/**
 * Order — selectors (pure derivations). PURE — không side effect, không import icon.
 */

import type { Order, OrderStatus } from "./types";

/**
 * Trạng thái cần người xử lý tay → gắn viền cảnh báo ở row (data-table-mode-a).
 * Ngoại lệ chờ nhân viên quyết: ON_HOLD (giữ đơn) và DELIVERY_FAILED (giao thất bại — giao lại hoặc trả về).
 */
const FLAGGED_STATUSES: readonly OrderStatus[] = ["On Hold", "Delivery Failed"];

export function shouldFlagOrderRow(order: Pick<Order, "status">): boolean {
  return FLAGGED_STATUSES.includes(order.status);
}
