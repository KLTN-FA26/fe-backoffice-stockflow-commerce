/**
 * Thao tác của khách trên đơn của mình (portal). UI-only — Backend phải re-check (scope OWN).
 * - "Đặt lại" (`POST /orders/{id}/reorder`) BE đã bỏ (WF-02 F1): khách mở chat với Sale ở storefront.
 * - Đổi trả (SCRUM-257): chỉ đơn đã giao; BE CHƯA có API RMA → hiển thị "chưa khả dụng".
 */

import type { OrderStatusGroup } from "@/constants";

export type MyOrderAction = "returnUnavailable";

export function allowedMyOrderActions(statusGroup: OrderStatusGroup): MyOrderAction[] {
  const actions: MyOrderAction[] = [];
  if (statusGroup === "DELIVERED") actions.push("returnUnavailable");
  return actions;
}
