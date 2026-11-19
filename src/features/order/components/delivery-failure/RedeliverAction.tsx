"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { RotateCcw } from "lucide-react";

import { DELIVERY_FAILURE_LABELS, DELIVERY_FAILURE_LIMITS } from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  DELIVERY_FAILURE_STALE_CODES,
  REDELIVERY_FIELD_ERRORS,
  deliveryFailureErrorView,
} from "../../delivery-failure-errors";
import { useRedeliverFailedShipment } from "../../delivery-failure-mutations";
import { redeliveryInputSchema } from "../../delivery-failure-schemas";
import { FormFieldError, RequiredMark } from "../FormFieldError";
import { OrderRefusalAlert } from "../OrderRefusalAlert";
import { useOrderActionErrors } from "../useOrderActionErrors";
import { usePendingSafeDialog } from "../usePendingSafeDialog";

import type {
  DeliveryFailureCase,
  RedeliveryFormValues,
  RedeliveryValues,
} from "../../delivery-failure-schemas";

const L = DELIVERY_FAILURE_LABELS.redeliver;

/**
 * "Giao lại" một hồ sơ giao thất bại (docs 09 §4.3; BE `POST …/redelivery`). Lý do khách gây ra (REFUSED / WRONG_ADDRESS)
 * → bắt buộc phí chuyến hỏng; lý do khác → không gửi phí (đòi hãng). UI-only — Backend phải re-check
 * (`sales-order-holds:UPDATE`, DELIVERY_FAILURE_INVALID_TRANSITION).
 */
export function RedeliverAction({
  failure,
  compact = false,
}: {
  failure: Pick<
    DeliveryFailureCase,
    "caseId" | "orderId" | "orderNumber" | "receiptNumber" | "customerPaysFailedTrip"
  >;
  compact?: boolean;
}) {
  const mutation = useRedeliverFailedShipment();
  const dialog = usePendingSafeDialog(mutation.isPending);
  return (
    <>
      <Button
        type="button"
        size="sm"
        className={compact ? undefined : "w-full"}
        aria-label={compact ? `${L.button} đơn ${failure.orderNumber}` : undefined}
        onClick={dialog.show}
      >
        <RotateCcw className="size-3.5" /> {L.button}
      </Button>
      <FormDialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
        <RedeliverForm failure={failure} mutation={mutation} onClose={dialog.close} />
      </FormDialog>
    </>
  );
}

function RedeliverForm({
  failure,
  mutation,
  onClose,
}: {
  failure: Parameters<typeof RedeliverAction>[0]["failure"];
  mutation: ReturnType<typeof useRedeliverFailedShipment>;
  onClose: () => void;
}) {
  const customerPays = failure.customerPaysFailedTrip;
  const form = useForm<RedeliveryFormValues, unknown, RedeliveryValues>({
    resolver: zodResolver(redeliveryInputSchema(customerPays)),
    mode: "onTouched",
    defaultValues: { note: "", failedTripFee: "" },
  });
  const errors = useOrderActionErrors(
    (error) => deliveryFailureErrorView(error, "redeliver"),
    DELIVERY_FAILURE_STALE_CODES,
    onClose,
    {
      map: REDELIVERY_FIELD_ERRORS,
      setError: (field, message) => form.setError(field, { type: "server", message }),
    },
  );
  const noteError = form.formState.errors.note?.message;
  const feeError = form.formState.errors.failedTripFee?.message;

  const submit = form.handleSubmit((values) => {
    if (!errors.beginSubmit()) return;
    errors.clearRefusal();
    const variables = { orderId: failure.orderId, caseId: failure.caseId, ...values };
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
      title={`${L.title} · ${failure.orderNumber}`}
      description={L.description(failure.receiptNumber ?? "—")}
      submitLabel={L.submit}
      canSubmit={form.formState.isValid}
      isPending={mutation.isPending}
      error={null}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="redeliver-note" className="text-ink-secondary text-xs font-medium">
          {L.note} <RequiredMark />
        </Label>
        <Textarea
          id="redeliver-note"
          rows={3}
          autoFocus
          maxLength={DELIVERY_FAILURE_LIMITS.noteMax}
          placeholder={L.notePlaceholder}
          aria-required="true"
          aria-invalid={noteError ? true : undefined}
          aria-describedby={noteError ? "redeliver-note-error" : undefined}
          {...form.register("note")}
        />
        <FormFieldError id="redeliver-note-error" message={noteError} />
      </div>
      {customerPays ? (
        <div className="grid gap-1.5">
          <Label htmlFor="redeliver-fee" className="text-ink-secondary text-xs font-medium">
            {L.fee} <RequiredMark />
          </Label>
          <Input
            id="redeliver-fee"
            inputMode="numeric"
            autoComplete="off"
            className="tabular-nums"
            aria-required="true"
            aria-invalid={feeError ? true : undefined}
            aria-describedby="redeliver-fee-hint"
            {...form.register("failedTripFee")}
          />
          <p id="redeliver-fee-hint" className="text-ink-tertiary text-xs">
            {L.feeHint}
          </p>
          <FormFieldError id="redeliver-fee-error" message={feeError} />
        </div>
      ) : (
        <p className="text-ink-secondary text-xs">{L.noFeeHint}</p>
      )}
      {errors.refusal && <OrderRefusalAlert view={errors.refusal} />}
    </FormDialogBody>
  );
}
