/**
 * Thao tác của khách trên đơn của mình (portal). UI-only — Backend phải re-check (scope OWN).
 * - Không có "đặt lại" trên đơn: mọi lối đặt lại mở chat với Sale (docs 13 BR-08).
 * - Đổi trả (SCRUM-257): chỉ đơn đã giao; BE CHƯA có API RMA → hiển thị "chưa khả dụng".
 */

import type { OrderStatusGroup } from "@/constants";

export type MyOrderAction = "returnUnavailable";

export function allowedMyOrderActions(statusGroup: OrderStatusGroup): MyOrderAction[] {
  const actions: MyOrderAction[] = [];
  if (statusGroup === "DELIVERED") actions.push("returnUnavailable");
  return actions;
}
