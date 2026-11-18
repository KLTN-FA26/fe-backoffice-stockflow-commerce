"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import {
  deliveredAtToSend,
  deliveryTimeProblem,
  toLocalInput,
} from "@/features/shipping/delivery-time";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { deliveryOutcomeInputSchema } from "@/features/shipping/input-schemas";
import { useRecordDeliveryOutcome } from "@/features/shipping/shipment-mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldError } from "../primitives";
import { DeliveryTimeField } from "./DeliveryTimeField";
import { FailureReasonField } from "./FailureReasonField";
import { OutcomeSummary } from "./OutcomeSummary";

import type { DeliveryOutcome } from "@/constants";
import type {
  DeliveryOutcomeFormInput,
  DeliveryOutcomeValues,
  Shipment,
} from "@/features/shipping/types";

const D = UI_LABELS.shipping.shipment.outcomeDialog;

interface OutcomeDialogProps {
  data: Shipment;
  outcome: DeliveryOutcome;
  onClose: () => void;
}

/**
 * Ghi nhận kết quả hãng báo lại (docs 09 §4.3, BR-02): đã giao (kèm thời điểm giao hãng báo — ngày lập hoá đơn nháp) /
 * giao thất bại (bắt buộc lý do; "Lý do khác" bắt buộc ghi chú) / hàng hoàn về kho. Ghi chú chỉ nhân viên xem. Mỗi lần
 * ghi nhận lưu người thực hiện và thời điểm (BE).
 */
export function OutcomeDialog({ data, outcome, onClose }: OutcomeDialogProps) {
  const { shipment } = data;
  // Callback mức hook: ghi nhận kết quả tải lại lô (đổi trạng thái) có thể gỡ hộp thoại trước callback của `mutate`
  const record = useRecordDeliveryOutcome({ onSuccess: onClose });
  const [serverError, setServerError] = useState<string | null>(null);
  const [opened] = useState(() => new Date());
  const [deliveredLocal, setDeliveredLocal] = useState(() => toLocalInput(opened));
  const [deliveredEdited, setDeliveredEdited] = useState(false);
  const form = useForm<DeliveryOutcomeFormInput, unknown, DeliveryOutcomeValues>({
    resolver: zodResolver(deliveryOutcomeInputSchema),
    mode: "onChange",
    defaultValues: { outcome, failureReason: undefined, note: "" },
  });
  const errors = form.formState.errors;
  const failed = outcome === "DELIVERY_FAILED";
  const delivered = outcome === "DELIVERED";
  const reason = useWatch({ control: form.control, name: "failureReason" });
  const timeProblem = delivered
    ? deliveryTimeProblem(deliveredLocal, { handedOverAt: shipment.handedOverAt })
    : null;
  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ type }) => {
          if (type === "change") setServerError(null);
        },
      }),
    [form],
  );

  const submit = form.handleSubmit((values) => {
    setServerError(null);
    record.mutate(
      {
        shipmentId: shipment.shipmentId,
        values: {
          ...values,
          deliveredAt: delivered ? deliveredAtToSend(deliveredLocal, deliveredEdited) : undefined,
        },
      },
      {
        onError: (error) => {
          setServerError(shippingErrorMessage(error));
          if (error instanceof ApiError) {
            for (const name of ["failureReason", "note"] as const) {
              const message = error.fieldErrors?.[name];
              if (message) form.setError(name, { type: "server", message });
            }
          }
        },
      },
    );
  });

  return (
    <FormDialog open onOpenChange={(next) => !next && !record.isPending && onClose()}>
      <FormDialogBody
        title={`${D[outcome].title} · ${shipment.code}`}
        description={D[outcome].description}
        submitLabel={D.confirm}
        canSubmit={form.formState.isValid && !timeProblem}
        isPending={record.isPending}
        error={serverError}
        onSubmit={() => void submit()}
        onCancel={() => !record.isPending && onClose()}
      >
        {/* Đã giao / hàng hoàn: bảng tóm tắt lô để người ghi nhận biết mình xác nhận lô nào (artboard) */}
        {!failed && <OutcomeSummary data={data} />}
        {delivered && (
          <DeliveryTimeField
            value={deliveredLocal}
            onChange={(next) => {
              setDeliveredLocal(next);
              setDeliveredEdited(true);
              setServerError(null);
            }}
            handedOverAt={shipment.handedOverAt}
            now={opened}
            error={timeProblem}
          />
        )}
        {/* Chỉ lần giao THẤT BẠI có lý do + ghi chú: BE không lưu ghi chú của kết quả khác */}
        {failed && (
          <>
            <Controller
              control={form.control}
              name="failureReason"
              render={({ field }) => (
                <FailureReasonField
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.failureReason?.message}
                />
              )}
            />
            <div>
              <Label
                htmlFor="outcome-note"
                className="text-ink-secondary mb-1 block text-xs font-medium"
              >
                {D.note} {reason === "OTHER" && <span className="text-danger">*</span>}
              </Label>
              <Textarea
                id="outcome-note"
                rows={2}
                maxLength={SHIPPING_LIMITS.noteMax}
                aria-invalid={errors.note ? true : undefined}
                aria-describedby="outcome-note-hint"
                className="border-border-default bg-bg-surface rounded-[var(--r-sm)] text-[0.8125rem]"
                {...form.register("note")}
              />
              <p id="outcome-note-hint" className="text-ink-tertiary mt-1 text-xs">
                {reason === "OTHER" ? D.noteRequired : D.noteOptional}
              </p>
              <FieldError>{errors.note?.message}</FieldError>
            </div>
          </>
        )}
        <p className="text-ink-tertiary text-xs">{D.audit}</p>
      </FormDialogBody>
    </FormDialog>
  );
}
