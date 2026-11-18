"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ORDER_DELIVERY_FAILURE_LABELS, SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import {
  correctionTarget,
  deliveryCorrectionInputSchema,
} from "@/features/shipping/correction-schemas";
import {
  deliveredAtToSend,
  deliveryTimeProblem,
  toLocalInput,
} from "@/features/shipping/delivery-time";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { useCorrectDeliveryOutcome } from "@/features/shipping/shipment-mutations";
import { Alert } from "@/components/shared/Alert";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldError } from "../primitives";
import { DeliveryTimeField } from "./DeliveryTimeField";
import { FailureReasonField } from "./FailureReasonField";
import { OutcomeSummary } from "./OutcomeSummary";

import type {
  DeliveryCorrectionFormInput,
  DeliveryCorrectionValues,
} from "@/features/shipping/correction-schemas";
import type { Shipment } from "@/features/shipping/types";

const C = UI_LABELS.shipping.shipment.correction;
const D = UI_LABELS.shipping.shipment.outcomeDialog;

/**
 * Sửa tay kết quả giao khi hãng báo sai (docs 09 §4.3 bước 5, E17): ĐÃ GIAO ↔ GIAO THẤT BẠI, lý do sửa bắt buộc. Sửa
 * thành giao thất bại thì chọn lý do (+ ghi chú nếu "Lý do khác"); sửa thành đã giao thì có thể nhập thời điểm giao.
 * Đơn đã hoàn tất, lô giao cả đơn… do BE từ chối (409) và hiện ngay trong hộp thoại.
 */
export function CorrectionDialog({ data, onClose }: { data: Shipment; onClose: () => void }) {
  const { shipment } = data;
  const target = correctionTarget(shipment.status) ?? "DELIVERED";
  const toFailed = target === "DELIVERY_FAILED";
  const correct = useCorrectDeliveryOutcome({ onSuccess: onClose });
  const [serverError, setServerError] = useState<string | null>(null);
  const [opened] = useState(() => new Date());
  const [deliveredLocal, setDeliveredLocal] = useState(() => toLocalInput(opened));
  const [deliveredEdited, setDeliveredEdited] = useState(false);
  const form = useForm<DeliveryCorrectionFormInput, unknown, DeliveryCorrectionValues>({
    resolver: zodResolver(deliveryCorrectionInputSchema),
    mode: "onChange",
    defaultValues: { outcome: target, failureReason: undefined, note: "", reason: "" },
  });
  const errors = form.formState.errors;
  const failureReason = useWatch({ control: form.control, name: "failureReason" });
  const timeProblem = toFailed
    ? null
    : deliveryTimeProblem(deliveredLocal, { handedOverAt: shipment.handedOverAt });
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
    correct.mutate(
      {
        shipmentId: shipment.shipmentId,
        values: {
          ...values,
          deliveredAt: toFailed ? undefined : deliveredAtToSend(deliveredLocal, deliveredEdited),
        },
      },
      {
        onError: (error) => {
          setServerError(shippingErrorMessage(error));
          if (error instanceof ApiError) {
            for (const name of ["failureReason", "note", "reason"] as const) {
              const message = error.fieldErrors?.[name];
              if (message) form.setError(name, { type: "server", message });
            }
          }
        },
      },
    );
  });

  const currentLabel = shipment.status === "DELIVERED" ? C.toDelivered : C.toFailed;
  const currentReason =
    shipment.status === "DELIVERY_FAILED" && shipment.failureReason
      ? (ORDER_DELIVERY_FAILURE_LABELS[
          shipment.failureReason as keyof typeof ORDER_DELIVERY_FAILURE_LABELS
        ] ?? shipment.failureReason)
      : null;

  return (
    <FormDialog open onOpenChange={(next) => !next && !correct.isPending && onClose()}>
      <FormDialogBody
        title={`${C.title} · ${shipment.code}`}
        description={C.description}
        submitLabel={C.submit}
        canSubmit={form.formState.isValid && !timeProblem}
        isPending={correct.isPending}
        error={serverError}
        onSubmit={() => void submit()}
        onCancel={() => !correct.isPending && onClose()}
      >
        <dl className="grid grid-cols-[8.75rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-[0.8125rem]">
          <dt className="text-ink-tertiary">{C.current}</dt>
          <dd className="text-ink-primary">
            <span className="font-medium">{currentLabel}</span>
            {currentReason && <span className="text-ink-tertiary"> · {currentReason}</span>}
          </dd>
          <dt className="text-ink-tertiary">{C.to}</dt>
          <dd className="text-ink-primary font-medium">{toFailed ? C.toFailed : C.toDelivered}</dd>
        </dl>
        <OutcomeSummary data={data} showCurrent={false} />
        {toFailed ? (
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
                htmlFor="correction-note"
                className="text-ink-secondary mb-1 block text-xs font-medium"
              >
                {D.note} {failureReason === "OTHER" && <span className="text-danger">*</span>}
              </Label>
              <Textarea
                id="correction-note"
                rows={2}
                maxLength={SHIPPING_LIMITS.noteMax}
                aria-invalid={errors.note ? true : undefined}
                className="border-border-default bg-bg-surface rounded-[var(--r-sm)] text-[0.8125rem]"
                {...form.register("note")}
              />
              <p className="text-ink-tertiary mt-1 text-xs">
                {failureReason === "OTHER" ? D.noteRequired : D.noteOptional}
              </p>
              <FieldError>{errors.note?.message}</FieldError>
            </div>
            <Alert tone="info">{C.invoiceNote}</Alert>
          </>
        ) : (
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
        <div>
          <Label
            htmlFor="correction-reason"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            {C.reason} <span className="text-danger">*</span>
          </Label>
          <Textarea
            id="correction-reason"
            rows={3}
            maxLength={SHIPPING_LIMITS.cancelReasonMax}
            placeholder={C.reasonPlaceholder}
            aria-invalid={errors.reason ? true : undefined}
            aria-describedby="correction-reason-hint"
            className="border-border-default bg-bg-surface rounded-[var(--r-sm)] text-[0.8125rem]"
            {...form.register("reason")}
          />
          <p id="correction-reason-hint" className="text-ink-tertiary mt-1 text-xs">
            {C.reasonHint}
          </p>
          <FieldError>{errors.reason?.message}</FieldError>
        </div>
        <p className="text-ink-tertiary text-xs">{D.audit}</p>
      </FormDialogBody>
    </FormDialog>
  );
}
