"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { useCorrectFailureReason } from "@/features/shipping/failure-reason-mutations";
import { failureReasonCorrectionInputSchema } from "@/features/shipping/failure-reason-schemas";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldError } from "../primitives";

import { FailureReasonField } from "./FailureReasonField";

import type {
  FailureReasonCorrectionFormInput,
  FailureReasonCorrectionValues,
} from "@/features/shipping/failure-reason-schemas";
import type { ShipmentRow } from "@/features/shipping/types";

const C = UI_LABELS.shipping.afterHandover.reasonCorrection;
const D = UI_LABELS.shipping.shipment.outcomeDialog;
const TEXTAREA = "border-border-default bg-bg-surface rounded-[var(--r-sm)] text-[0.8125rem]";
const LABEL = "text-ink-secondary mb-1 block text-xs font-medium";

/**
 * Sửa lý do giao thất bại khi quản lý kho đã biết lý do thật (docs 09 edge "hoàn hàng khi còn Handed Over"): chọn lý do,
 * ghi chú ("Khác" bắt buộc), lý do sửa (bắt buộc). Trạng thái lô không đổi. Backend phải re-check quyền và trạng thái.
 */
export function FailureReasonCorrectionDialog({
  shipment,
  onClose,
}: {
  shipment: Pick<ShipmentRow, "shipmentId" | "code">;
  onClose: () => void;
}) {
  const correct = useCorrectFailureReason({ onSuccess: onClose });
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<FailureReasonCorrectionFormInput, unknown, FailureReasonCorrectionValues>({
    resolver: zodResolver(failureReasonCorrectionInputSchema),
    mode: "onChange",
    defaultValues: { failureReason: undefined, note: "", reason: "" },
  });
  const errors = form.formState.errors;
  const picked = useWatch({ control: form.control, name: "failureReason" });

  const submit = form.handleSubmit((values) => {
    setServerError(null);
    correct.mutate(
      { shipmentId: shipment.shipmentId, values },
      { onError: (error) => setServerError(shippingErrorMessage(error)) },
    );
  });

  return (
    <FormDialog open onOpenChange={(next) => !next && !correct.isPending && onClose()}>
      <FormDialogBody
        title={`${C.title} · ${shipment.code}`}
        description={C.description}
        submitLabel={C.confirm}
        canSubmit={form.formState.isValid}
        isPending={correct.isPending}
        error={serverError}
        onSubmit={() => void submit()}
        onCancel={() => !correct.isPending && onClose()}
      >
        <Controller
          control={form.control}
          name="failureReason"
          render={({ field }) => (
            // Cùng sáu thẻ chọn một như lúc ghi giao thất bại (UX audit S01-6)
            <FailureReasonField
              value={field.value ?? undefined}
              onChange={field.onChange}
              error={errors.failureReason?.message}
            />
          )}
        />
        <div>
          <Label htmlFor="correction-note" className={LABEL}>
            {D.note} {picked === "OTHER" && <span className="text-danger">*</span>}
          </Label>
          <Textarea
            id="correction-note"
            rows={2}
            maxLength={SHIPPING_LIMITS.noteMax}
            aria-invalid={errors.note ? true : undefined}
            className={TEXTAREA}
            {...form.register("note")}
          />
          <FieldError>{errors.note?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="correction-reason" className={LABEL}>
            {C.reasonLabel} <span className="text-danger">*</span>
          </Label>
          <Textarea
            id="correction-reason"
            rows={2}
            maxLength={SHIPPING_LIMITS.noteMax}
            aria-invalid={errors.reason ? true : undefined}
            aria-describedby="correction-reason-hint"
            className={TEXTAREA}
            {...form.register("reason")}
          />
          <p id="correction-reason-hint" className="text-ink-tertiary mt-1 text-xs">
            {C.reasonHint}
          </p>
          <FieldError>{errors.reason?.message}</FieldError>
        </div>
      </FormDialogBody>
    </FormDialog>
  );
}
