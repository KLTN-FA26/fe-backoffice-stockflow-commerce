"use client";

import { Truck } from "lucide-react";

import { ORDER_DELIVERY_MODE_LABELS, ORDER_DELIVERY_MODE_UI } from "@/constants";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { deliveryModeControl } from "../delivery-mode";
import { ESTIMABLE_RELEASED_STATUSES } from "../estimate-slot";
import { useChangeDeliveryMode } from "../mutations";

import { OrderDeliveryModeDialog } from "./OrderDeliveryModeDialog";
import { ORDER_ACTION_BUTTON, useOrderActionDialog } from "./useOrderActionDialog";

import type { PermissionCode } from "@/lib/auth";
import type { OrderEstimateSlot } from "../estimate-slot";
import type { Order } from "../types";

interface OrderDeliveryModeCardProps {
  order: Pick<
    Order,
    | "orderId"
    | "orderNumber"
    | "status"
    | "deliveryMode"
    | "deliveryModeLocked"
    | "paymentTerm"
    | "balancePolicy"
  >;
  can: (code: PermissionCode) => boolean;
  /** Khe "Ước tính xếp xe" cho đơn đã release (xem `estimate-slot.ts`). */
  estimateSlot?: OrderEstimateSlot;
}

/**
 * Hình thức giao của đơn (BE PR #157, LP-1): ai đọc được đơn đều thấy; nút đổi chỉ hiện với mã quyền
 * `sales-order-delivery-modes:UPDATE` khi đơn chưa khoá. Đã khoá (`deliveryModeLocked`) → nói rõ lý do. Đơn đã
 * release còn có nút "Ước tính xếp xe". BE không trả hình thức → không hiện gì (không đoán).
 */
export function OrderDeliveryModeCard({ order, can, estimateSlot }: OrderDeliveryModeCardProps) {
  const dialog = useOrderActionDialog("deliveryMode");
  const { mutate, isPending } = useChangeDeliveryMode(dialog.hookOptions);
  const control = deliveryModeControl(order, can);
  if (!control) return null;
  const L = ORDER_DELIVERY_MODE_UI.card;
  const current = control.mode === "UNKNOWN" ? "PARCEL" : control.mode;
  const estimate = ESTIMABLE_RELEASED_STATUSES.includes(order.status)
    ? estimateSlot?.({
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        warehouseId: null,
        released: true,
      })
    : null;

  return (
    <section
      aria-label={L.title}
      className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]"
    >
      <h2 className="text-ink-primary mb-2 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Truck className="text-accent size-4" aria-hidden="true" />
        {L.title}
      </h2>
      <p className="text-ink-primary text-[0.8125rem] font-medium">
        {ORDER_DELIVERY_MODE_LABELS[control.mode]}
      </p>
      {control.mode !== "UNKNOWN" && (
        <p className="text-ink-secondary mt-1 text-xs">
          {ORDER_DELIVERY_MODE_UI.hint[control.mode]}
        </p>
      )}
      {control.canChange && (
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={dialog.show}
            className={ORDER_ACTION_BUTTON}
          >
            {L.change}
          </Button>
        </div>
      )}
      {order.deliveryModeLocked === true && (
        <p className="text-ink-tertiary mt-3 text-xs">
          <span className="font-medium">{L.lockedTitle}.</span> {L.lockedReason}
        </p>
      )}
      {estimate && <div className="mt-3">{estimate}</div>}
      {dialog.open && (
        <OrderDeliveryModeDialog
          order={order}
          current={current}
          isPending={isPending}
          error={dialog.error}
          onSubmit={(values) =>
            mutate(
              { id: order.orderId, ...values },
              { onSuccess: () => toast.success(ORDER_DELIVERY_MODE_UI.dialog.success) },
            )
          }
          onClose={dialog.close}
        />
      )}
    </section>
  );
}
