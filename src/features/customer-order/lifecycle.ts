/**
 * Thao tác của khách trên đơn của mình (portal). UI-only — Backend phải re-check (scope OWN).
 * - Đặt lại: chỉ khi BE báo `allowedActions.reorder` và khách có CREATE; đơn mua theo
 *   giá niêm yết không tạo lại báo giá cũ.
 * - Đổi trả (SCRUM-257): chỉ đơn đã giao; BE CHƯA có API RMA → hiển thị "chưa khả dụng".
 */

import { ORDER_PERMISSIONS } from "@/constants";

import type { OrderStatusGroup } from "@/constants";
import type { PermissionCode } from "@/lib/auth/me-permissions";

export type MyOrderAction = "reorder" | "returnUnavailable";

export function allowedMyOrderActions(
  statusGroup: OrderStatusGroup,
  allowedActions: { reorder: boolean } | null | undefined,
  can: (code: PermissionCode) => boolean,
): MyOrderAction[] {
  const actions: MyOrderAction[] = [];
  if (allowedActions?.reorder && can(ORDER_PERMISSIONS.create)) actions.push("reorder");
  if (statusGroup === "DELIVERED") actions.push("returnUnavailable");
  return actions;
}
