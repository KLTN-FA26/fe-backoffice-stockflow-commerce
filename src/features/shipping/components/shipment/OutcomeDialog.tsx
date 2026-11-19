"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useDeliveryTimeInput } from "@/features/shipping/useDeliveryTimeInput";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { deliveryOutcomeInputSchema } from "@/features/shipping/input-schemas";
import { useRecordDeliveryOutcome } from "@/features/shipping/shipment-mutations";
import { DialogScrollArea } from "@/components/shared/DialogScrollArea";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { DeliveryTimeField } from "./DeliveryTimeField";
import { FailureNoteField } from "./FailureNoteField";
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
  const delivered = outcome === "DELIVERED";
  const time = useDeliveryTimeInput(shipment.handedOverAt, delivered);
  const form = useForm<DeliveryOutcomeFormInput, unknown, DeliveryOutcomeValues>({
    resolver: zodResolver(deliveryOutcomeInputSchema),
    mode: "onChange",
    defaultValues: { outcome, failureReason: undefined, note: "" },
  });
  const errors = form.formState.errors;
  const failed = outcome === "DELIVERY_FAILED";
  const reason = useWatch({ control: form.control, name: "failureReason" });
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
          deliveredAt: time.toSend(),
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
        canSubmit={form.formState.isValid && !time.problem}
        isPending={record.isPending}
        error={serverError}
        onSubmit={() => void submit()}
        onCancel={() => !record.isPending && onClose()}
      >
        <DialogScrollArea>
          {/* Đã giao / hàng hoàn: bảng tóm tắt lô để người ghi nhận biết mình xác nhận lô nào (artboard) */}
          {!failed && <OutcomeSummary data={data} />}
          {delivered && (
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
              <FailureNoteField
                id="outcome-note"
                register={form.register("note")}
                reasonIsOther={reason === "OTHER"}
                error={errors.note?.message}
              />
            </>
          )}
          <p className="text-ink-tertiary text-xs">{D.audit}</p>
        </DialogScrollArea>
      </FormDialogBody>
    </FormDialog>
  );
}
