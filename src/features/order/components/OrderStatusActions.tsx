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
import { Button } from "@/components/ui/button";

import { deliveryFailureSchema, holdOrderSchema, resolveOrderHoldSchema } from "../input-schemas";
import { useHoldOrder, useRecordDeliveryFailure, useResolveOrderHold } from "../mutations";

import { OrderReasonDialog } from "./OrderReasonDialog";
import { ORDER_ACTION_BUTTON, toReasonOptions, useOrderActionDialog } from "./useOrderActionDialog";

import type { Order } from "../types";

type ActionOrder = Pick<Order, "orderId" | "orderNumber">;

export function OrderHoldAction({ order }: { order: ActionOrder }) {
  const dialog = useOrderActionDialog("hold");
  const { mutate, isPending } = useHoldOrder(dialog.hookOptions);
  const labels = ORDER_ACTION_LABELS.hold;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={dialog.show}
        className={ORDER_ACTION_BUTTON}
      >
        <PauseCircle className="size-3.5" /> {labels.button}
      </Button>
      {dialog.open && (
        <OrderReasonDialog
          title={labels.title}
          description={`${labels.description} (${order.orderNumber})`}
          submitLabel={labels.submit}
          reasonLabel={labels.reasonLabel}
          reasons={toReasonOptions(ORDER_MANUAL_HOLD_REASONS, ORDER_HOLD_REASON_LABELS)}
          noteLabel={labels.noteLabel}
          noteMax={ORDER_LIMITS.holdNoteMax}
          schema={holdOrderSchema}
          isPending={isPending}
          error={dialog.error}
          onSubmit={(values) => mutate({ id: order.orderId, ...values })}
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={dialog.show}
        className={ORDER_ACTION_BUTTON}
      >
        <CircleCheck className="size-3.5" /> {labels.button}
      </Button>
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
          onSubmit={(values) => mutate({ id: order.orderId, ...values })}
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={dialog.show}
        className={ORDER_ACTION_BUTTON}
      >
        <PackageX className="size-3.5" /> {labels.button}
      </Button>
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
          onSubmit={(values) => mutate({ id: order.orderId, ...values })}
          onClose={dialog.close}
        />
      )}
    </>
  );
}
