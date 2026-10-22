import { ORDER_ACTION_LABELS, ORDER_HOLD_GUIDANCE, ORDER_PERMISSIONS } from "@/constants";
import { StatusDot } from "@/components/shared/StatusDot";

import { allowedOrderActions, isOrderTerminal } from "../lifecycle";

import { OrderCancelAction } from "./OrderCancelAction";
import { OrderHoldNotice } from "./OrderHoldNotice";
import { OrderReleaseAction } from "./OrderReleaseAction";
import { OrderRemainderClosureAction } from "./OrderRemainderClosureAction";
import {
  OrderDeliveryFailureAction,
  OrderHoldAction,
  OrderResolveHoldAction,
} from "./OrderStatusActions";

import type { PermissionCode } from "@/lib/auth";
import type { OrderEstimateSlot } from "../estimate-slot";
import type { Order } from "../types";

interface OrderActionCardProps {
  order: Pick<
    Order,
    | "orderId"
    | "orderNumber"
    | "status"
    | "holdReason"
    | "holdReasonPublic"
    | "holdNote"
    | "statusBeforeHold"
    | "shipments"
    | "packedAt"
    | "deliveryMode"
    | "paymentTerm"
    | "balancePolicy"
  >;
  can: (code: PermissionCode) => boolean;
  /** Khe "Ước tính xếp xe" trong hộp thoại release (xem `estimate-slot.ts`). */
  estimateSlot?: OrderEstimateSlot;
}

/** Vì sao không có nút thao tác — để người dùng không tưởng là lỗi. */
function noActionReason(order: OrderActionCardProps["order"]): string {
  if (order.status === "UNKNOWN") return "Trạng thái đơn chưa được hỗ trợ — không có thao tác.";
  if (isOrderTerminal(order.status)) return "Đơn đã kết thúc — không còn thao tác.";
  // BR-ORD-004: từ PACKED hàng đã đóng — không huỷ được, đi luồng trả hàng
  if (
    ["Packed", "Shipped", "Delivery Failed", "Delivered", "Return Requested"].includes(order.status)
  ) {
    return "Đơn đã đóng gói / bàn giao vận chuyển — chỉ xử lý qua luồng trả hàng.";
  }
  return "Bạn chỉ có quyền xem đơn hàng.";
}

/**
 * Vì sao không có nút "Gỡ giữ" khi đơn bị giữ: giữ do hệ thống → nói xử lý ở đâu; lý do không rõ
 * (BE thêm mã mới / không trả `holdReason`) → không đoán, báo chưa gỡ được. Giữ do điều phối viên mà
 * người xem thiếu quyền thì không cần giải thích thêm.
 */
function holdGuidanceFor(
  order: Pick<Order, "holdReason">,
  can: (code: PermissionCode) => boolean,
): string | null {
  switch (order.holdReason) {
    case "CREDIT":
      return ORDER_HOLD_GUIDANCE.CREDIT;
    case "DESIGN_MISMATCH":
      return ORDER_HOLD_GUIDANCE.DESIGN_MISMATCH;
    case null:
    case "UNKNOWN":
      return can(ORDER_PERMISSIONS.approve) ? ORDER_HOLD_GUIDANCE.UNRESOLVABLE : null;
    default:
      return null;
  }
}

/**
 * Card trạng thái + thao tác ở cột phải trang chi tiết (cùng bố cục ActionCard của NCC).
 * Gate theo trạng thái + mã quyền + ngữ cảnh đơn qua `allowedOrderActions` — Backend phải re-check
 * (bảng chuyển trạng thái BE PR #133).
 */
export function OrderActionCard({ order, can, estimateSlot }: OrderActionCardProps) {
  const actions = allowedOrderActions(order.status, can, {
    holdReason: order.holdReason,
    hasShipments: order.shipments.length > 0,
    packedAt: order.packedAt,
    statusBeforeHold: order.statusBeforeHold,
  });
  const has = (code: string) => actions.some((a) => a.code === code);
  const onHold = order.status === "On Hold";
  // Giữ do hệ thống: nói rõ phải xử lý ở đâu thay vì để người dùng tìm nút "Gỡ giữ" không có
  const holdGuidance = onHold && !has("resolve-hold") ? holdGuidanceFor(order, can) : null;
  const shipmentsHint =
    order.shipments.length > 0 &&
    ["Shipped", "Partially Fulfilled"].includes(order.status) &&
    can(ORDER_PERMISSIONS.approve)
      ? ORDER_ACTION_LABELS.shipmentsHint
      : null;

  const guidance = holdGuidance ?? shipmentsHint;

  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <div className="mb-4 flex justify-center">
        <StatusDot domain="order" status={order.status} size="md" withIcon />
      </div>
      {onHold && <OrderHoldNotice order={order} />}
      {actions.length > 0 ? (
        <div className="space-y-2">
          {has("release") && (
            <OrderReleaseAction order={order} can={can} estimateSlot={estimateSlot} />
          )}
          {has("hold") && <OrderHoldAction order={order} />}
          {has("resolve-hold") && <OrderResolveHoldAction order={order} />}
          {has("delivery-failure") && <OrderDeliveryFailureAction order={order} />}
          {has("remainder-closure") && <OrderRemainderClosureAction order={order} />}
          {has("admin-cancel") && <OrderCancelAction order={order} />}
        </div>
      ) : null}
      {guidance && <p className="text-ink-secondary mt-3 text-center text-xs">{guidance}</p>}
      {actions.length === 0 && !guidance && (
        <p className="text-ink-tertiary text-center text-xs">{noActionReason(order)}</p>
      )}
    </section>
  );
}
