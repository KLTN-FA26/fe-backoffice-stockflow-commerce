"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, PackageX, PauseCircle, Scissors } from "lucide-react";
import { useRef, useState } from "react";

import {
  ORDER_ACTION_LABELS,
  ORDER_DELIVERY_FAILURE_LABELS,
  ORDER_DELIVERY_FAILURE_REASONS,
  ORDER_LIMITS,
  ORDER_MANUAL_HOLD_REASONS,
  ORDER_HOLD_REASON_LABELS,
  ORDER_REMAINDER_CLOSURE_LABELS,
  ORDER_REMAINDER_CLOSURE_REASONS,
  UI_LABELS,
} from "@/constants";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { createIdempotencyAttempt } from "@/lib/api/idempotency";

import { ORDER_STALE_ERROR_CODES, orderActionErrorView } from "../errors";
import {
  useCloseOrderRemainder,
  useHoldOrder,
  useRecordDeliveryFailure,
  useResolveOrderHold,
} from "../mutations";
import { orderKeys } from "../queries";
import {
  deliveryFailureSchema,
  holdOrderSchema,
  remainderClosureSchema,
  resolveOrderHoldSchema,
} from "../action-schemas";

import { OrderReasonDialog } from "./OrderReasonDialog";

import type { ApiError } from "@/lib/api/error";
import type { OrderStatusActionKey } from "../errors";
import type { Order } from "../types";

type ActionOrder = Pick<Order, "orderId" | "orderNumber">;

const BUTTON =
  "border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted w-full rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem] font-medium";

function toOptions<const K extends string>(
  keys: readonly K[],
  labels: Record<K, string>,
): { value: K; label: string }[] {
  return keys.map((value) => ({ value, label: labels[value] }));
}

/**
 * Trạng thái dialog + xử lý lỗi chung của bốn thao tác. Lỗi do dữ liệu cũ (đơn đã đổi trạng thái)
 * → đóng dialog, tải lại đơn, báo qua toast; lỗi khác giữ dialog + dữ liệu đã nhập, hiện tại chỗ.
 */
function useActionDialog(action: OrderStatusActionKey) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  // Một "lần thử logic" mỗi lần mở dialog (cùng phạm vi với dialog huỷ / release): cùng nội dung bấm
  // lại sau lỗi tạm thời → cùng Idempotency-Key; nội dung khác → key mới; thành công → bỏ key.
  const [attempt] = useState(() => createIdempotencyAttempt());
  // Chặn gửi lặp (double-click / Enter lặp) — như `useOrderActionErrors.beginSubmit`: `isPending` chỉ
  // đổi ở lần render sau, nên cú bấm thứ hai trước lúc đó vẫn gửi request thứ hai (cùng key, BE replay).
  const inFlight = useRef(false);

  const hookOptions = {
    onSuccess: () => {
      inFlight.current = false;
      attempt.reset();
      setOpen(false);
    },
    onError: (apiError: ApiError) => {
      inFlight.current = false;
      // BE đã chốt kết quả / key bị dùng sai → bỏ key; BE nhả claim (409, 5xx, mạng) → giữ key
      attempt.settle(apiError);
      const view = orderActionErrorView(apiError, action);
      const detail = view.traceId
        ? `${view.detail} (${UI_LABELS.common.traceId}: ${view.traceId})`
        : view.detail;
      if (ORDER_STALE_ERROR_CODES.includes(apiError.code)) {
        setOpen(false);
        void queryClient.invalidateQueries({ queryKey: orderKeys.all });
        toast.error(view.title, detail);
      } else {
        // Bản ghi đã bị người khác ghi trước → tải lại đơn, giữ dialog + dữ liệu đã nhập
        if (apiError.code === "OPTIMISTIC_LOCK") {
          void queryClient.invalidateQueries({ queryKey: orderKeys.all });
        }
        setError(detail);
      }
    },
  };

  return {
    open,
    error,
    hookOptions,
    /**
     * Gửi một lần: bỏ qua khi request trước của dialog chưa có kết quả. Biến mutation kèm
     * Idempotency-Key của lần thử hiện tại (header, không vào body).
     */
    submit: <T extends object>(
      mutate: (variables: T & { idempotencyKey: string }) => void,
      variables: T,
    ) => {
      if (inFlight.current) return;
      inFlight.current = true;
      mutate({ ...variables, idempotencyKey: attempt.keyFor(variables) });
    },
    show: () => {
      inFlight.current = false;
      attempt.reset();
      setError(null);
      setOpen(true);
    },
    close: () => setOpen(false),
  };
}

export function OrderHoldAction({ order }: { order: ActionOrder }) {
  const dialog = useActionDialog("hold");
  const { mutate, isPending } = useHoldOrder(dialog.hookOptions);
  const labels = ORDER_ACTION_LABELS.hold;
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={dialog.show} className={BUTTON}>
        <PauseCircle className="size-3.5" /> {labels.button}
      </Button>
      {dialog.open && (
        <OrderReasonDialog
          title={labels.title}
          description={`${labels.description} (${order.orderNumber})`}
          submitLabel={labels.submit}
          reasonLabel={labels.reasonLabel}
          reasons={toOptions(ORDER_MANUAL_HOLD_REASONS, ORDER_HOLD_REASON_LABELS)}
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
  const dialog = useActionDialog("resolveHold");
  const { mutate, isPending } = useResolveOrderHold(dialog.hookOptions);
  const labels = ORDER_ACTION_LABELS.resolveHold;
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={dialog.show} className={BUTTON}>
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
          onSubmit={(values) => dialog.submit(mutate, { id: order.orderId, ...values })}
          onClose={dialog.close}
        />
      )}
    </>
  );
}

export function OrderDeliveryFailureAction({ order }: { order: ActionOrder }) {
  const dialog = useActionDialog("deliveryFailure");
  const { mutate, isPending } = useRecordDeliveryFailure(dialog.hookOptions);
  const labels = ORDER_ACTION_LABELS.deliveryFailure;
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={dialog.show} className={BUTTON}>
        <PackageX className="size-3.5" /> {labels.button}
      </Button>
      {dialog.open && (
        <OrderReasonDialog
          title={labels.title}
          description={`${labels.description} (${order.orderNumber})`}
          submitLabel={labels.submit}
          reasonLabel={labels.reasonLabel}
          reasons={toOptions(ORDER_DELIVERY_FAILURE_REASONS, ORDER_DELIVERY_FAILURE_LABELS)}
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

export function OrderRemainderClosureAction({ order }: { order: ActionOrder }) {
  const dialog = useActionDialog("remainderClosure");
  const { mutate, isPending } = useCloseOrderRemainder(dialog.hookOptions);
  const labels = ORDER_ACTION_LABELS.remainderClosure;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={dialog.show}
        className="border-danger text-danger hover:bg-danger/10 w-full rounded-[var(--r-sm)] border bg-transparent px-3 py-2 text-[0.8125rem] font-medium"
      >
        <Scissors className="size-3.5" /> {labels.button}
      </Button>
      {dialog.open && (
        <OrderReasonDialog
          title={labels.title}
          description={`${labels.description} (${order.orderNumber})`}
          submitLabel={labels.submit}
          reasonLabel={labels.reasonLabel}
          reasons={toOptions(ORDER_REMAINDER_CLOSURE_REASONS, ORDER_REMAINDER_CLOSURE_LABELS)}
          noteLabel={labels.noteLabel}
          noteMax={ORDER_LIMITS.remainderClosureNoteMax}
          schema={remainderClosureSchema}
          isPending={isPending}
          error={dialog.error}
          onSubmit={(values) => dialog.submit(mutate, { id: order.orderId, ...values })}
          onClose={dialog.close}
        />
      )}
    </>
  );
}
