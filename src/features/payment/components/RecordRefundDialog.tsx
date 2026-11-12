"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_LIMITS } from "@/constants/payment";
import { formatMoney } from "@/lib/format";
import { DatePicker } from "@/components/shared/DatePicker";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";

import { paymentErrorMessage } from "../errors";
import { useRecordRefund } from "../mutations";
import { buildRefundRecordInputSchema, todayInVietnam } from "../input-schemas";

import type { OrderRefund, RefundRecordFormValues, RefundRecordInput } from "../types";

const L = PAYMENT_LABELS.recordRefundDialog;

function RecordRefundForm({ refund, onClose }: { refund: OrderRefund; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const record = useRecordRefund();
  const schema = useMemo(() => buildRefundRecordInputSchema(refund.remaining), [refund.remaining]);
  const form = useForm<RefundRecordFormValues, unknown, RefundRecordInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: String(refund.remaining),
      refundedOn: todayInVietnam(),
      reference: "",
      note: "",
    },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((values) =>
    record.mutate(
      { orderId: refund.orderId, ...values },
      { onSuccess: onClose, onError: (failure) => setError(paymentErrorMessage(failure)) },
    ),
  );

  return (
    <FormDialogBody
      title={`${L.title} — ${refund.orderNumber}`}
      description={L.description}
      submitLabel={L.submit}
      canSubmit
      isPending={record.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          id="refund-amount"
          label={L.amount}
          required
          error={errors.amount?.message}
          hint={
            PAYMENT_LABELS.refunds.remaining + ": " + formatMoney(refund.remaining, refund.currency)
          }
        >
          <Input
            autoFocus
            inputMode="numeric"
            className={`${FORM_INPUT_CLASS} text-right tabular-nums`}
            {...fieldA11y("refund-amount", errors.amount?.message, true)}
            {...form.register("amount")}
          />
        </FormField>
        <FormField
          id="refund-date"
          label={L.refundedOn}
          required
          error={errors.refundedOn?.message}
        >
          <Controller
            control={form.control}
            name="refundedOn"
            render={({ field }) => (
              <DatePicker
                id="refund-date"
                value={field.value}
                onChange={field.onChange}
                max={todayInVietnam()}
                aria-invalid={errors.refundedOn ? true : undefined}
              />
            )}
          />
        </FormField>
      </div>
      <FormField
        id="refund-reference"
        label={L.reference}
        required
        error={errors.reference?.message}
      >
        <Input
          maxLength={PAYMENT_LIMITS.referenceMax}
          className={FORM_INPUT_CLASS}
          {...fieldA11y("refund-reference", errors.reference?.message)}
          {...form.register("reference")}
        />
      </FormField>
      <FormField id="refund-note" label={L.note} error={errors.note?.message}>
        <Input
          maxLength={PAYMENT_LIMITS.noteMax}
          className={FORM_INPUT_CLASS}
          {...fieldA11y("refund-note", errors.note?.message)}
          {...form.register("note")}
        />
      </FormField>
    </FormDialogBody>
  );
}

/** Ghi nhận đã hoàn tiền cho khách (docs 15 §4.5 bước 16): số tiền không vượt số còn phải hoàn (BR-14). */
export function RecordRefundDialog({
  refund,
  onClose,
}: {
  refund: OrderRefund | null;
  onClose: () => void;
}) {
  return (
    <FormDialog open={refund !== null} onOpenChange={(open) => !open && onClose()}>
      {refund && <RecordRefundForm refund={refund} onClose={onClose} />}
    </FormDialog>
  );
}
