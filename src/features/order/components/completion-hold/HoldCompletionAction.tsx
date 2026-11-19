"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { PauseCircle } from "lucide-react";

import {
  COMPLETION_HOLD_LABELS,
  COMPLETION_HOLD_LIMITS,
  COMPLETION_HOLD_REASON_LABELS,
  COMPLETION_HOLD_REASONS,
} from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";

import { useHoldCompletion } from "../../completion-hold-mutations";
import { holdCompletionInputSchema } from "../../completion-hold-schemas";
import { COMPLETION_HOLD_STALE_CODES, completionHoldErrorView } from "../../errors";
import { OrderRefusalAlert } from "../OrderRefusalAlert";
import { NoteField, ReasonSelectField } from "../ReasonDialogFields";
import { useOrderActionErrors } from "../useOrderActionErrors";
import { usePendingSafeDialog } from "../usePendingSafeDialog";

import type { HoldCompletionFormValues, HoldCompletionValues } from "../../completion-hold-schemas";
import type { Order } from "../../types";

const L = COMPLETION_HOLD_LABELS.hold;
const REASON_OPTIONS = COMPLETION_HOLD_REASONS.map((value) => ({
  value,
  label: COMPLETION_HOLD_REASON_LABELS[value],
}));

type Target = Pick<Order, "orderId" | "orderNumber">;

/**
 * "Giữ hoàn tất" (WF-05 GH-2; BE `POST /orders/{id}/completion-hold`): lý do + ghi chú (bắt buộc với "Lý do khác").
 * UI-only — Backend phải re-check (`sales-order-holds:UPDATE`, ORDER_COMPLETION_ALREADY_HELD / _HOLD_NOT_APPLICABLE).
 */
export function HoldCompletionAction({ order }: { order: Target }) {
  const mutation = useHoldCompletion();
  const dialog = usePendingSafeDialog(mutation.isPending);
  return (
    <>
      <Button type="button" size="sm" variant="outline" className="w-full" onClick={dialog.show}>
        <PauseCircle className="size-3.5" aria-hidden="true" /> {L.button}
      </Button>
      <FormDialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
        <HoldCompletionForm order={order} mutation={mutation} onClose={dialog.close} />
      </FormDialog>
    </>
  );
}

function HoldCompletionForm({
  order,
  mutation,
  onClose,
}: {
  order: Target;
  mutation: ReturnType<typeof useHoldCompletion>;
  onClose: () => void;
}) {
  const form = useForm<HoldCompletionFormValues, unknown, HoldCompletionValues>({
    resolver: zodResolver(holdCompletionInputSchema),
    mode: "onTouched",
    defaultValues: { reasonCode: "", note: "" },
  });
  const errors = useOrderActionErrors(
    (error) => completionHoldErrorView(error, "hold"),
    COMPLETION_HOLD_STALE_CODES,
    onClose,
  );
  const reason = useWatch({ control: form.control, name: "reasonCode" });

  const submit = form.handleSubmit((values) => {
    if (!errors.beginSubmit()) return;
    errors.clearRefusal();
    const variables = { orderId: order.orderId, ...values };
    mutation.mutate(
      { ...variables, idempotencyKey: errors.idempotencyKeyFor(variables) },
      {
        onSuccess: () => {
          errors.finishAttempt();
          onClose();
        },
        onError: errors.onError,
      },
    );
  });

  return (
    <FormDialogBody
      title={`${L.title} · ${order.orderNumber}`}
      description={L.description(order.orderNumber)}
      submitLabel={L.submit}
      canSubmit={reason !== ""}
      isPending={mutation.isPending}
      error={null}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <Controller
        control={form.control}
        name="reasonCode"
        render={({ field, fieldState }) => (
          <ReasonSelectField
            label={L.reason}
            options={REASON_OPTIONS}
            value={field.value}
            error={fieldState.error?.message}
            onChange={field.onChange}
          />
        )}
      />
      <Controller
        control={form.control}
        name="note"
        render={({ field, fieldState }) => (
          <NoteField
            label={L.note}
            placeholder={L.notePlaceholder}
            value={field.value}
            max={COMPLETION_HOLD_LIMITS.noteMax}
            required={reason === "OTHER"}
            autoFocus={false}
            hint={L.noteHintOther}
            error={fieldState.error?.message}
            onChange={field.onChange}
          />
        )}
      />
      {errors.refusal && <OrderRefusalAlert view={errors.refusal} />}
    </FormDialogBody>
  );
}
