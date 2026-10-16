/**
 * Order — selectors (pure derivations). PURE — không side effect, không import icon.
 */

import type { Order, OrderStatus } from "./types";

/**
 * Trạng thái cần người xử lý tay → gắn viền cảnh báo ở row (data-table-mode-a).
 * Trong 10 trạng thái BE chỉ ON_HOLD là "đang chờ xử lý ngoại lệ".
 */
const FLAGGED_STATUSES: readonly OrderStatus[] = ["On Hold"];

export function shouldFlagOrderRow(order: Pick<Order, "status">): boolean {
  return FLAGGED_STATUSES.includes(order.status);
}
