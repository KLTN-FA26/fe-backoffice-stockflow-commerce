"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_LIMITS } from "@/constants/payment";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Textarea } from "@/components/ui/textarea";

import { paymentErrorMessage } from "../errors";
import { useVoidRefundRecord } from "../mutations";
import { voidRefundInputSchema } from "../input-schemas";

import type { RefundRecord, VoidRefundInput } from "../types";

const L = PAYMENT_LABELS.voidRefundDialog;

function VoidRefundForm({ record, onClose }: { record: RefundRecord; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const voidRecord = useVoidRefundRecord();
  const form = useForm<VoidRefundInput>({
    resolver: zodResolver(voidRefundInputSchema),
    defaultValues: { reason: "" },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((values) =>
    voidRecord.mutate(
      { recordId: record.refundRecordId, reason: values.reason },
      { onSuccess: onClose, onError: (failure) => setError(paymentErrorMessage(failure)) },
    ),
  );

  return (
    <FormDialogBody
      title={`${L.title} ${record.reference}`}
      description={L.description}
      submitLabel={L.submit}
      danger
      canSubmit
      isPending={voidRecord.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <FormField id="void-refund-reason" label={L.reason} required error={errors.reason?.message}>
        <Textarea
          autoFocus
          rows={3}
          maxLength={PAYMENT_LIMITS.reasonMax}
          className={FORM_TEXTAREA_CLASS}
          {...fieldA11y("void-refund-reason", errors.reason?.message)}
          {...form.register("reason")}
        />
      </FormField>
    </FormDialogBody>
  );
}

/** Huỷ một ghi nhận hoàn ghi sai (docs 15 §4.5 bước 16): bắt buộc lý do; số tiền quay lại thành còn phải hoàn. */
export function VoidRefundDialog({
  record,
  onClose,
}: {
  record: RefundRecord | null;
  onClose: () => void;
}) {
  return (
    <FormDialog open={record !== null} onOpenChange={(open) => !open && onClose()}>
      {record && <VoidRefundForm record={record} onClose={onClose} />}
    </FormDialog>
  );
}
