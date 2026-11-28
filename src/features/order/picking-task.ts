/**
 * Lối tạo nhiệm vụ lấy hàng từ chi tiết đơn (docs 07 §4.1 bước 2): đơn đã có lệnh xuất kho (`Ready to Fulfill`) mà chưa có
 * nhiệm vụ, và người xem được tạo nhiệm vụ (quản lý kho của kho xuất). Trả đường dẫn màn Lấy hàng của kho xuất với hộp tạo
 * mở sẵn đúng đơn này, hoặc `null`. UI-only — Backend phải re-check (fulfillment-task-assignment:CREATE).
 */

import { ADMIN_ROUTES, FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS } from "@/constants";

import type { PermissionCode } from "@/lib/auth";
import type { Order } from "./types";

export function createPickingTaskHref(
  order: Pick<Order, "status" | "warehouseCode" | "orderId">,
  can: (code: PermissionCode) => boolean,
): string | null {
  if (order.status !== "Ready to Fulfill" || !order.warehouseCode) return null;
  if (!can(FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS.create)) return null;
  return ADMIN_ROUTES.warehouseMap.pickingCreate(order.warehouseCode, order.orderId);
}
