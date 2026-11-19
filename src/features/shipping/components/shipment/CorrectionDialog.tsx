"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import {
  correctionTarget,
  deliveryCorrectionInputSchema,
} from "@/features/shipping/correction-schemas";
import { useDeliveryTimeInput } from "@/features/shipping/useDeliveryTimeInput";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { useCorrectDeliveryOutcome } from "@/features/shipping/shipment-mutations";
import { Alert } from "@/components/shared/Alert";
import { DialogScrollArea } from "@/components/shared/DialogScrollArea";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { CorrectionCurrent } from "./CorrectionCurrent";
import { CorrectionReasonField } from "./CorrectionReasonField";
import { DeliveryTimeField } from "./DeliveryTimeField";
import { FailureNoteField } from "./FailureNoteField";
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
  const time = useDeliveryTimeInput(shipment.handedOverAt, !toFailed);
  const form = useForm<DeliveryCorrectionFormInput, unknown, DeliveryCorrectionValues>({
    resolver: zodResolver(deliveryCorrectionInputSchema),
    mode: "onChange",
    defaultValues: { outcome: target, failureReason: undefined, note: "", reason: "" },
  });
  const errors = form.formState.errors;
  const failureReason = useWatch({ control: form.control, name: "failureReason" });
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
          deliveredAt: time.toSend(),
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

  return (
    <FormDialog open onOpenChange={(next) => !next && !correct.isPending && onClose()}>
      <FormDialogBody
        title={`${C.title} · ${shipment.code}`}
        description={C.description}
        submitLabel={C.submit}
        canSubmit={form.formState.isValid && !time.problem}
        isPending={correct.isPending}
        error={serverError}
        onSubmit={() => void submit()}
        onCancel={() => !correct.isPending && onClose()}
      >
        <DialogScrollArea>
          <CorrectionCurrent shipment={shipment} toFailed={toFailed} />
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
              <FailureNoteField
                id="correction-note"
                register={form.register("note")}
                reasonIsOther={failureReason === "OTHER"}
                error={errors.note?.message}
              />
              <Alert tone="info">{C.invoiceNote}</Alert>
            </>
          ) : (
            <DeliveryTimeField
              value={time.local}
              onChange={(next) => {
                time.onChange(next);
                setServerError(null);
              }}
              handedOverAt={shipment.handedOverAt}
              now={time.opened}
              error={time.problem}
            />
          )}
          <CorrectionReasonField
            register={form.register("reason")}
            error={errors.reason?.message}
          />
          <p className="text-ink-tertiary text-xs">{D.audit}</p>
        </DialogScrollArea>
      </FormDialogBody>
    </FormDialog>
  );
}
