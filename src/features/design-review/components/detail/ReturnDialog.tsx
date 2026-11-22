"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { DESIGN_REASON_MAX, DESIGN_REVIEW_LABELS } from "@/constants";

import { designReturnInputSchema } from "@/features/design-review/schemas";

import { ConfirmReasonField } from "@/components/shared/ConfirmReasonField";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Notice } from "@/components/shared/Notice";

import type {
  DesignReturnFormOutput,
  DesignReturnFormValues,
} from "@/features/design-review/types";

interface ReturnFormProps {
  /** Gợi ý vì sao nên trả lại (vd file khách gửi không còn khớp bố cục). */
  hint: string | null;
  pending: boolean;
  error: string | null;
  onSubmit: (notes: string) => void;
  onCancel: () => void;
}

function ReturnForm({ hint, pending, error, onSubmit, onCancel }: ReturnFormProps) {
  const form = useForm<DesignReturnFormValues, unknown, DesignReturnFormOutput>({
    resolver: zodResolver(designReturnInputSchema),
    defaultValues: { approved: false, notes: "" },
  });
  const message = form.formState.errors.notes?.message;
  const submit = form.handleSubmit((values) => onSubmit(values.notes));

  return (
    <FormDialogBody
      title={DESIGN_REVIEW_LABELS.returnTitle}
      description={DESIGN_REVIEW_LABELS.returnDescription}
      submitLabel={DESIGN_REVIEW_LABELS.return}
      canSubmit
      isPending={pending}
      error={error}
      danger
      onSubmit={() => void submit()}
      onCancel={onCancel}
    >
      {hint && <Notice tone="warning">{hint}</Notice>}
      <Controller
        control={form.control}
        name="notes"
        render={({ field }) => (
          <ConfirmReasonField
            label={DESIGN_REVIEW_LABELS.returnReasonLabel}
            value={field.value}
            onChange={field.onChange}
            maxLength={DESIGN_REASON_MAX}
          />
        )}
      />
      {message && (
        <p role="alert" className="text-danger text-xs">
          {message}
        </p>
      )}
      {pending && (
        <p role="status" className="text-ink-secondary text-[0.8125rem]">
          {DESIGN_REVIEW_LABELS.deciding}
        </p>
      )}
    </FormDialogBody>
  );
}

/** Trả lại — lý do bắt buộc 1–2000 ký tự, khách sẽ thấy (12 BR-06). Form unmount khi đóng nên lần mở sau trống. */
export function ReturnDialog({
  open,
  onOpenChange,
  ...form
}: ReturnFormProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => (form.pending ? undefined : onOpenChange(next))}
    >
      {open && <ReturnForm {...form} />}
    </FormDialog>
  );
}
