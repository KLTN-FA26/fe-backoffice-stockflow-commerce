"use client";

import { CircleCheck, PackageX, PauseCircle } from "lucide-react";

import {
  ORDER_ACTION_LABELS,
  ORDER_DELIVERY_FAILURE_LABELS,
  ORDER_DELIVERY_FAILURE_REASONS,
  ORDER_LIMITS,
  ORDER_MANUAL_HOLD_REASONS,
  ORDER_HOLD_REASON_LABELS,
} from "@/constants";
import { ActionTrigger } from "@/components/shared/ObjectActions";

import { deliveryFailureSchema, holdOrderSchema, resolveOrderHoldSchema } from "../input-schemas";
import { useHoldOrder, useRecordDeliveryFailure, useResolveOrderHold } from "../mutations";

import { OrderReasonDialog } from "./OrderReasonDialog";
import { toReasonOptions, useOrderActionDialog } from "./useOrderActionDialog";

import type { Order } from "../types";

type ActionOrder = Pick<Order, "orderId" | "orderNumber">;

export function OrderHoldAction({
  order,
}: {
  order: ActionOrder & Partial<Pick<Order, "firstLabeledAt">>;
}) {
  const dialog = useOrderActionDialog("hold");
  const { mutate, isPending } = useHoldOrder(dialog.hookOptions);
  const labels = ORDER_ACTION_LABELS.hold;
  return (
    <>
      <ActionTrigger icon={PauseCircle} label={labels.button} onClick={dialog.show} />
      {dialog.open && (
        <OrderReasonDialog
          title={labels.title}
          description={`${labels.description} (${order.orderNumber})`}
          submitLabel={labels.submit}
          reasonLabel={labels.reasonLabel}
          reasons={toReasonOptions(ORDER_MANUAL_HOLD_REASONS, ORDER_HOLD_REASON_LABELS)}
          // Đã dán nhãn thì địa chỉ đã khoá (BE `firstLabeledAt`, docs 08 BR-04): giữ ADDRESS chỉ chặn dán nhãn tiếp / hoàn tất
          reasonWarnings={
            order.firstLabeledAt ? { ADDRESS: labels.addressLockedWarning } : undefined
          }
          noteLabel={labels.noteLabel}
          noteMax={ORDER_LIMITS.holdNoteMax}
          schema={holdOrderSchema}
          isPending={isPending}
          error={dialog.error}
          onSubmit={(values) => dialog.submit(mutate, { id: order.orderId, ...values })}
          onClose={dialog.close}
        />
      )}
    </>
  );
}

export function OrderResolveHoldAction({ order }: { order: ActionOrder }) {
  const dialog = useOrderActionDialog("resolveHold");
  const { mutate, isPending } = useResolveOrderHold(dialog.hookOptions);
  const labels = ORDER_ACTION_LABELS.resolveHold;
  return (
    <>
      <ActionTrigger icon={CircleCheck} label={labels.button} onClick={dialog.show} />
      {dialog.open && (
        <OrderReasonDialog
          title={labels.title}
          description={`${labels.description} (${order.orderNumber})`}
          submitLabel={labels.submit}
          noteLabel={labels.noteLabel}
          noteMax={ORDER_LIMITS.resolveNoteMax}
          noteAlwaysRequired
          schema={resolveOrderHoldSchema}
          isPending={isPending}
          error={dialog.error}
          onSubmit={(values) => dialog.submit(mutate, { id: order.orderId, ...values })}
          onClose={dialog.close}
        />
      )}
    </>
  );
}

export function OrderDeliveryFailureAction({ order }: { order: ActionOrder }) {
  const dialog = useOrderActionDialog("deliveryFailure");
  const { mutate, isPending } = useRecordDeliveryFailure(dialog.hookOptions);
  const labels = ORDER_ACTION_LABELS.deliveryFailure;
  return (
    <>
      <ActionTrigger icon={PackageX} label={labels.button} onClick={dialog.show} />
      {dialog.open && (
        <OrderReasonDialog
          title={labels.title}
          description={`${labels.description} (${order.orderNumber})`}
          submitLabel={labels.submit}
          reasonLabel={labels.reasonLabel}
          reasons={toReasonOptions(ORDER_DELIVERY_FAILURE_REASONS, ORDER_DELIVERY_FAILURE_LABELS)}
          noteLabel={labels.noteLabel}
          noteMax={ORDER_LIMITS.deliveryFailureNoteMax}
          schema={deliveryFailureSchema}
          isPending={isPending}
          error={dialog.error}
          onSubmit={(values) => dialog.submit(mutate, { id: order.orderId, ...values })}
          onClose={dialog.close}
        />
      )}
    </>
  );
}
