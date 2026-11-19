"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { XCircle } from "lucide-react";

import { DELIVERY_FAILURE_LABELS, DELIVERY_FAILURE_LIMITS } from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  CANCEL_UNDELIVERED_FIELD_ERRORS,
  DELIVERY_FAILURE_STALE_CODES,
  deliveryFailureErrorView,
} from "../../delivery-failure-errors";
import { useCancelUndelivered } from "../../delivery-failure-mutations";
import {
  CANCEL_UNDELIVERED_DEFAULTS,
  cancelUndeliveredInputSchema,
} from "../../delivery-failure-schemas";
import { DANGER_OUTLINE_BUTTON } from "../button-styles";
import { FormFieldError, RequiredMark } from "../FormFieldError";
import { OrderRefusalAlert } from "../OrderRefusalAlert";
import { useOrderActionErrors } from "../useOrderActionErrors";
import { usePendingSafeDialog } from "../usePendingSafeDialog";

import { AgreedFeeInputs } from "./AgreedFeeInputs";

import type {
  CancelUndeliveredFormValues,
  CancelUndeliveredValues,
} from "../../delivery-failure-schemas";

const L = DELIVERY_FAILURE_LABELS.cancel;

interface CancelTarget {
  orderId: string;
  orderNumber: string;
  /** Vắng = huỷ khi lô về chưa có hồ sơ (`POST /orders/{id}/delivery-failures/cancellation`). */
  caseId?: string;
}

/**
 * "Huỷ phần chưa giao" (docs 17 §4.8 bước 33, 15 §4.6 bước 19; BE `…/cancellation`): đóng phần còn lại của đơn kèm phí
 * thoả thuận (tuỳ chọn). Không hoàn tác được. UI-only — Backend phải re-check (`sales-order-cancellations:UPDATE`,
 * DELIVERY_FAILURE_REST_NOT_CLOSABLE).
 */
export function CancelUndeliveredAction({
  target,
  compact = false,
}: {
  target: CancelTarget;
  compact?: boolean;
}) {
  const mutation = useCancelUndelivered();
  const dialog = usePendingSafeDialog(mutation.isPending);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`${DANGER_OUTLINE_BUTTON} ${compact ? "" : "w-full"}`}
        aria-label={compact ? `${L.button} đơn ${target.orderNumber}` : undefined}
        onClick={dialog.show}
      >
        <XCircle className="size-3.5" /> {L.button}
      </Button>
      <FormDialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
        <CancelForm target={target} mutation={mutation} onClose={dialog.close} />
      </FormDialog>
    </>
  );
}

function CancelForm({
  target,
  mutation,
  onClose,
}: {
  target: CancelTarget;
  mutation: ReturnType<typeof useCancelUndelivered>;
  onClose: () => void;
}) {
  const form = useForm<CancelUndeliveredFormValues, unknown, CancelUndeliveredValues>({
    resolver: zodResolver(cancelUndeliveredInputSchema),
    mode: "onTouched",
    defaultValues: CANCEL_UNDELIVERED_DEFAULTS,
  });
  const withFee = useWatch({ control: form.control, name: "withFee" });
  const errors = useOrderActionErrors(
    (error) => deliveryFailureErrorView(error, "cancel"),
    DELIVERY_FAILURE_STALE_CODES,
    onClose,
    {
      map: CANCEL_UNDELIVERED_FIELD_ERRORS,
      setError: (field, message) => form.setError(field, { type: "server", message }),
    },
  );
  const noteError = form.formState.errors.note?.message;

  const submit = form.handleSubmit((values) => {
    if (!errors.beginSubmit()) return;
    errors.clearRefusal();
    const variables = { orderId: target.orderId, caseId: target.caseId, ...values };
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
      title={`${L.title} · ${target.orderNumber}`}
      description={
        target.caseId
          ? L.description(target.orderNumber)
          : L.descriptionWithoutCase(target.orderNumber)
      }
      submitLabel={L.submit}
      danger
      canSubmit={form.formState.isValid}
      isPending={mutation.isPending}
      error={null}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="cancel-undelivered-note" className="text-ink-secondary text-xs font-medium">
          {L.note} <RequiredMark />
        </Label>
        <Textarea
          id="cancel-undelivered-note"
          rows={3}
          autoFocus
          maxLength={DELIVERY_FAILURE_LIMITS.noteMax}
          placeholder={L.notePlaceholder}
          aria-required="true"
          aria-invalid={noteError ? true : undefined}
          aria-describedby={noteError ? "cancel-undelivered-note-error" : undefined}
          {...form.register("note")}
        />
        <FormFieldError id="cancel-undelivered-note-error" message={noteError} />
      </div>
      <AgreedFeeInputs form={form} enabled={withFee} />
      {errors.refusal && <OrderRefusalAlert view={errors.refusal} />}
    </FormDialogBody>
  );
}
