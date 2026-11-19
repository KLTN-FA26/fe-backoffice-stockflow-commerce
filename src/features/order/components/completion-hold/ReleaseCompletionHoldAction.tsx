"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { PlayCircle } from "lucide-react";

import { COMPLETION_HOLD_LABELS, COMPLETION_HOLD_LIMITS } from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";

import { useReleaseCompletionHold } from "../../completion-hold-mutations";
import { releaseCompletionHoldInputSchema } from "../../completion-hold-schemas";
import { COMPLETION_HOLD_STALE_CODES, completionHoldErrorView } from "../../errors";
import { OrderRefusalAlert } from "../OrderRefusalAlert";
import { NoteField } from "../ReasonDialogFields";
import { useOrderActionErrors } from "../useOrderActionErrors";
import { usePendingSafeDialog } from "../usePendingSafeDialog";

import type {
  ReleaseCompletionHoldFormValues,
  ReleaseCompletionHoldValues,
} from "../../completion-hold-schemas";
import type { Order } from "../../types";

const L = COMPLETION_HOLD_LABELS.release;

type Target = Pick<Order, "orderId" | "orderNumber">;

/**
 * "Gỡ giữ" hoàn tất (WF-05 GH-2; BE `POST /orders/{id}/completion-hold/release`): ghi kết quả xác minh (bắt buộc).
 * UI-only — Backend phải re-check (`sales-order-holds:UPDATE`, ORDER_COMPLETION_NOT_HELD).
 */
export function ReleaseCompletionHoldAction({ order }: { order: Target }) {
  const mutation = useReleaseCompletionHold();
  const dialog = usePendingSafeDialog(mutation.isPending);
  return (
    <>
      <Button type="button" size="sm" className="w-full" onClick={dialog.show}>
        <PlayCircle className="size-3.5" aria-hidden="true" /> {L.button}
      </Button>
      <FormDialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
        <ReleaseForm order={order} mutation={mutation} onClose={dialog.close} />
      </FormDialog>
    </>
  );
}

function ReleaseForm({
  order,
  mutation,
  onClose,
}: {
  order: Target;
  mutation: ReturnType<typeof useReleaseCompletionHold>;
  onClose: () => void;
}) {
  const form = useForm<ReleaseCompletionHoldFormValues, unknown, ReleaseCompletionHoldValues>({
    resolver: zodResolver(releaseCompletionHoldInputSchema),
    mode: "onTouched",
    defaultValues: { note: "" },
  });
  const note = useWatch({ control: form.control, name: "note" });
  const errors = useOrderActionErrors(
    (error) => completionHoldErrorView(error, "release"),
    COMPLETION_HOLD_STALE_CODES,
    onClose,
  );

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
      canSubmit={note.trim() !== ""}
      isPending={mutation.isPending}
      error={null}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <Controller
        control={form.control}
        name="note"
        render={({ field, fieldState }) => (
          <NoteField
            label={L.note}
            placeholder={L.notePlaceholder}
            value={field.value}
            max={COMPLETION_HOLD_LIMITS.noteMax}
            required
            autoFocus
            hint={null}
            error={fieldState.error?.message}
            onChange={field.onChange}
          />
        )}
      />
      {errors.refusal && <OrderRefusalAlert view={errors.refusal} />}
    </FormDialogBody>
  );
}
