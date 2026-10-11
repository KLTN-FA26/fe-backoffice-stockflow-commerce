import { CREDIT_HOLD_PERMISSIONS, ORDER_PERMISSIONS } from "@/constants";
import { StatusDot } from "@/components/shared/StatusDot";

import { allowedOrderActions, isOrderTerminal } from "../lifecycle";
import { releaseBlockers } from "../selectors";

import { CreditApproveAction } from "./credit-hold/CreditApproveAction";
import { CreditRejectAction } from "./credit-hold/CreditRejectAction";
import { OrderCancelAction } from "./OrderCancelAction";
import { OrderReleaseAction } from "./OrderReleaseAction";

import type { PermissionCode } from "@/lib/auth";
import type { OrderActionCode } from "../lifecycle";
import type { Order } from "../types";

interface OrderActionCardProps {
  order: Order;
  can: (code: PermissionCode) => boolean;
}

/** Vì sao không có nút thao tác — để người dùng không tưởng là lỗi. */
function noActionReason(order: Order, can: OrderActionCardProps["can"]): string {
  if (isOrderTerminal(order.status)) return "Đơn đã kết thúc — không còn thao tác.";
  if (
    !can(ORDER_PERMISSIONS.cancel) &&
    !can(ORDER_PERMISSIONS.release) &&
    !can(CREDIT_HOLD_PERMISSIONS.approve)
  ) {
    return "Bạn chỉ có quyền xem đơn hàng.";
  }
  // BE BR-031; docs BR-03: từ SHIPPED không huỷ được nữa
  return "Đơn đã bàn giao vận chuyển — chỉ xử lý qua luồng trả hàng.";
}

/**
 * Card trạng thái + thao tác ở cột phải trang chi tiết (cùng bố cục ActionCard của NCC).
 * Nút do `allowedOrderActions` quyết (trạng thái + mã quyền + đơn công nợ) — không rải if/else.
 * UI-only gating — Backend phải re-check (BR-031, OrderReleaseService, CreditHoldService).
 */
export function OrderActionCard({ order, can }: OrderActionCardProps) {
  const actions = allowedOrderActions(order.status, can, { paymentTerm: order.paymentTerm });
  const has = (code: OrderActionCode) => actions.some((a) => a.code === code);
  // Lý do chưa release biết trước — chỉ cho người có quyền release (Coordinator)
  const blockers = can(ORDER_PERMISSIONS.release) ? releaseBlockers(order) : [];

  return (
    <section
      aria-label="Thao tác đơn"
      className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]"
    >
      <div className="mb-4 flex justify-center">
        <StatusDot domain="order" status={order.status} size="md" withIcon />
      </div>
      <div className="space-y-2">
        {has("release") && <OrderReleaseAction order={order} />}
        {has("credit-approve") && <CreditApproveAction order={order} />}
        {has("credit-reject") && <CreditRejectAction order={order} />}
        {blockers.length > 0 && (
          <div className="border-border-default bg-bg-subtle rounded-[var(--r-sm)] border px-3 py-2 text-xs">
            <p className="text-ink-primary font-medium">Chưa release được</p>
            <ul className="text-ink-secondary mt-1 space-y-0.5">
              {blockers.map((b) => (
                <li key={b.rule}>
                  <span className="font-[family-name:var(--font-mono)]">{b.rule}</span> ·{" "}
                  {b.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {has("admin-cancel") && <OrderCancelAction order={order} />}
        {actions.length === 0 && blockers.length === 0 && (
          <p className="text-ink-tertiary text-center text-xs">{noActionReason(order, can)}</p>
        )}
      </div>
    </section>
  );
}
