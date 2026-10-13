/**
 * Thao tác của khách trên đơn của mình (portal). UI-only — Backend phải re-check (scope OWN).
 * - Đặt lại: mọi đơn chưa huỷ → BE tạo yêu cầu báo giá mới (R1/R1b); đơn không đặt từ báo giá
 *   bị BE từ chối ORDER_NOT_QUOTED.
 * - Đổi trả (SCRUM-257): chỉ đơn đã giao; BE CHƯA có API RMA → hiển thị "chưa khả dụng".
 */

import { ORDER_PERMISSIONS } from "@/constants";

import type { OrderStatusGroup } from "@/constants";
import type { PermissionCode } from "@/lib/auth/me-permissions";

export type MyOrderAction = "reorder" | "returnUnavailable";

export function allowedMyOrderActions(
  statusGroup: OrderStatusGroup,
  can: (code: PermissionCode) => boolean,
): MyOrderAction[] {
  const actions: MyOrderAction[] = [];
  if (statusGroup !== "CANCELLED" && can(ORDER_PERMISSIONS.read)) actions.push("reorder");
  if (statusGroup === "DELIVERED") actions.push("returnUnavailable");
  return actions;
}
