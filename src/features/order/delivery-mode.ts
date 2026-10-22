/**
 * Order — hình thức giao (LP-1/LP-2, BE PR #157): điều khiển trên chi tiết đơn + luật FTL / COD.
 * Pure: đơn + mã quyền → điều khiển. Quyền tra theo MÃ (`sales-order-delivery-modes:UPDATE`), không theo vai trò.
 */

import { ORDER_PERMISSIONS } from "@/constants";

import type { PermissionCode } from "@/lib/auth";
import type { Order, OrderDeliveryMode } from "./types";

/** Điều khiển "Hình thức giao" của một đơn. */
export interface DeliveryModeControl {
  readonly mode: Order["deliveryMode"] & string;
  /** BE `deliveryModeLocked`: kho đã bắt đầu đóng gói, hoặc đơn đã qua đóng gói / huỷ / đóng. */
  readonly locked: boolean;
  /** Có mã quyền VÀ chưa khoá — mới hiện nút đổi. */
  readonly canChange: boolean;
}

/**
 * Điều khiển hình thức giao, hoặc null khi BE không trả `deliveryMode` (dòng danh sách) — không đoán.
 * `deliveryModeLocked` null (BE không trả) → coi là khoá: không đoán đơn còn mở.
 */
export function deliveryModeControl(
  order: Pick<Order, "deliveryMode" | "deliveryModeLocked">,
  can: (code: PermissionCode) => boolean,
): DeliveryModeControl | null {
  if (order.deliveryMode === null) return null;
  const locked = order.deliveryModeLocked !== false;
  return {
    mode: order.deliveryMode,
    locked,
    // UI-only — Backend phải re-check (PUT /orders/{id}/delivery-mode: @RequiresPermission + 409 LOCKED)
    canChange: !locked && can(ORDER_PERMISSIONS.deliveryModes),
  };
}

/**
 * LP-2 (BE `ck_order_ftl_no_cod`): giao nguyên xe không đi cùng thu tiền khi giao. Đơn cọc có cách thu phần còn
 * lại ON_DELIVERY mà chọn FTL → BE 409 DELIVERY_MODE_FTL_NO_COD. FE báo trước; BE vẫn là bên quyết.
 */
export function ftlConflictsWithCod(
  order: Pick<Order, "balancePolicy">,
  mode: OrderDeliveryMode,
): boolean {
  return mode === "FULL_TRUCKLOAD" && order.balancePolicy === "ON_DELIVERY";
}
