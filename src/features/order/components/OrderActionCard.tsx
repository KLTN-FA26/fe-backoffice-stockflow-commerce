import { ORDER_PERMISSIONS } from "@/constants";
import { StatusDot } from "@/components/shared/StatusDot";

import { allowedOrderActions, isOrderTerminal } from "../lifecycle";

import { OrderCancelAction } from "./OrderCancelAction";

import type { PermissionCode } from "@/lib/auth";
import type { Order } from "../types";

interface OrderActionCardProps {
  order: Pick<Order, "orderId" | "orderNumber" | "status">;
  can: (code: PermissionCode) => boolean;
}

/** Vì sao không có nút thao tác — để người dùng không tưởng là lỗi. */
function noActionReason(order: OrderActionCardProps["order"], canCancel: boolean): string {
  if (isOrderTerminal(order.status)) return "Đơn đã kết thúc — không còn thao tác.";
  if (!canCancel) return "Bạn chỉ có quyền xem đơn hàng.";
  // BE BR-031; docs BR-03: từ SHIPPED không huỷ được nữa
  return "Đơn đã bàn giao vận chuyển — chỉ xử lý qua luồng trả hàng.";
}

/**
 * Card trạng thái + thao tác ở cột phải trang chi tiết (cùng bố cục ActionCard của NCC).
 * Gate theo trạng thái + mã quyền qua `allowedOrderActions` — Backend phải re-check (BR-031).
 */
export function OrderActionCard({ order, can }: OrderActionCardProps) {
  const actions = allowedOrderActions(order.status, can);
  const canCancel = actions.some((a) => a.code === "admin-cancel");

  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <div className="mb-4 flex justify-center">
        <StatusDot domain="order" status={order.status} size="md" withIcon />
      </div>
      {canCancel ? (
        <OrderCancelAction order={order} />
      ) : (
        <p className="text-ink-tertiary text-center text-xs">
          {noActionReason(order, can(ORDER_PERMISSIONS.cancel))}
        </p>
      )}
    </section>
  );
}
