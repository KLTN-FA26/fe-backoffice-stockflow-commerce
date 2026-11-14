"use client";

import { useState } from "react";
import { Controller } from "react-hook-form";

import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_LIMITS } from "@/constants/payment";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { DatePicker } from "@/components/shared/DatePicker";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";

import { paymentErrorMessage } from "../errors";
import { useRecordReceipt } from "../mutations";
import { todayInVietnam } from "../input-schemas";
import { useReceiptForm } from "../useReceiptForm";

import { ReceiptLinesEditor } from "./ReceiptLinesEditor";

import type { Installment, PaymentReceipt } from "../types";

const L = PAYMENT_LABELS.recordDialog;

function RecordReceiptForm({
  initial,
  onClose,
  onRecorded,
}: {
  initial: Installment;
  onClose: () => void;
  onRecorded?: (receipt: PaymentReceipt) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const record = useRecordReceipt();
  const { form, lines, choices, loadFailed } = useReceiptForm(initial);
  const { errors } = form.formState;
  const submit = form.handleSubmit((values) =>
    record.mutate(values, {
      onSuccess: (receipt) => {
        onClose();
        onRecorded?.(receipt);
      },
      onError: (failure) => setError(paymentErrorMessage(failure)),
    }),
  );

  return (
    <FormDialogBody
      title={L.title}
      description={L.description}
      submitLabel={L.submit}
      canSubmit
      isPending={record.isPending}
      error={error ?? (loadFailed ? L.loadFailed : null)}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          id="receipt-reference"
          label={L.reference}
          required
          error={errors.reference?.message}
          hint={L.referenceHint}
        >
          <Input
            autoFocus
            maxLength={PAYMENT_LIMITS.referenceMax}
            className={FORM_INPUT_CLASS}
            {...fieldA11y("receipt-reference", errors.reference?.message, true)}
            {...form.register("reference")}
          />
        </FormField>
        <FormField
          id="receipt-received-on"
          label={L.receivedOn}
          required
          error={errors.receivedOn?.message}
        >
          <Controller
            control={form.control}
            name="receivedOn"
            render={({ field }) => (
              <DatePicker
                id="receipt-received-on"
                value={field.value}
                onChange={field.onChange}
                max={todayInVietnam()}
                aria-invalid={errors.receivedOn ? true : undefined}
              />
            )}
          />
        </FormField>
      </div>
      <ReceiptLinesEditor
        control={form.control}
        register={form.register}
        setValue={form.setValue}
        errors={errors}
        choices={choices}
        watched={lines}
        currency={initial.currency}
      />
      {errors.lines?.message && (
        <p role="alert" className="text-danger text-xs">
          {errors.lines.message}
        </p>
      )}
      <FormField id="receipt-note" label={L.note} error={errors.note?.message}>
        <Input
          maxLength={PAYMENT_LIMITS.noteMax}
          className={FORM_INPUT_CLASS}
          {...fieldA11y("receipt-note", errors.note?.message)}
          {...form.register("note")}
        />
      </FormField>
    </FormDialogBody>
  );
}

/**
 * Lập phiếu thu từ một đợt (docs 15 §4.2 bước 6): khách lấy từ đợt, thêm được các đợt khác còn nhận
 * tiền của CÙNG khách. Phiếu `Recorded` không sửa được (BR-04) — ghi sai thì huỷ phiếu và lập lại.
 */
export function RecordReceiptDialog({
  installment,
  onClose,
  onRecorded,
}: {
  installment: Installment | null;
  onClose: () => void;
  onRecorded?: (receipt: PaymentReceipt) => void;
}) {
  return (
    <FormDialog
      open={installment !== null}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-[640px]"
    >
      {installment && (
        <RecordReceiptForm initial={installment} onClose={onClose} onRecorded={onRecorded} />
      )}
    </FormDialog>
  );
}
