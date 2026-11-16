"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { LOAD_STATUS, SHIPPING_LIMITS, TOAST_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { waybillInputSchema } from "@/features/shipping/input-schemas";
import { useRecordWaybill } from "@/features/shipping/waybill-mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { toast } from "@/components/shared/Toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldError, MONO, fieldClass } from "../primitives";

import type { Load, WaybillFormInput, WaybillValues } from "@/features/shipping/types";

const D = UI_LABELS.shipping.waybill.dialog;
const F = UI_LABELS.shipping.field;
const SERVER_FIELDS = ["waybillNo", "vehiclePlate", "driverName", "driverPhone", "reason"] as const;

/**
 * Nhập tay mã vận đơn của chuyến (BE `PUT loads/{id}/waybill`, docs 09 §4.4 (3)); trước khi rời kho kèm biển số / tài xế
 * nếu biết. Chuyến đã rời kho (DISPATCHED) là SỬA mã (BR-24): chỉ đổi mã, bắt buộc lý do — biển số / tài xế không gửi.
 * Lỗi 409 WAYBILL_DUPLICATE / WAYBILL_FROM_CARRIER_API hiện inline. Backend phải re-check quyền + trạng thái.
 */
export function WaybillDialog({ load, onClose }: { load: Load; onClose: () => void }) {
  const afterDeparture = load.status === LOAD_STATUS.DISPATCHED;
  const record = useRecordWaybill({
    onSuccess: () => {
      toast.success(
        afterDeparture
          ? TOAST_MESSAGES.shipping.waybillCorrected
          : TOAST_MESSAGES.shipping.waybillRecorded,
      );
      onClose();
    },
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<WaybillFormInput, unknown, WaybillValues>({
    resolver: zodResolver(waybillInputSchema(afterDeparture)),
    mode: "onChange",
    defaultValues: {
      waybillNo: load.waybillNo ?? "",
      vehiclePlate: load.vehiclePlate ?? "",
      driverName: load.driverName ?? "",
      driverPhone: load.driverPhone ?? "",
      reason: "",
    },
  });
  // Sửa bất kỳ ô nào → lỗi máy chủ của lần gửi trước không còn đúng
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
  const errors = form.formState.errors;
  const submit = form.handleSubmit((values) => {
    setServerError(null);
    // Sau khi rời kho chỉ đổi mã: biển số / tài xế nằm trên biên bản đã ký (BE 400 nếu khác)
    const body: WaybillValues = afterDeparture
      ? {
          waybillNo: values.waybillNo,
          reason: values.reason,
          vehiclePlate: undefined,
          driverName: undefined,
          driverPhone: undefined,
        }
      : values;
    record.mutate(
      { loadId: load.loadId, values: body },
      {
        onError: (error) => {
          setServerError(shippingErrorMessage(error));
          if (!(error instanceof ApiError)) return;
          for (const name of SERVER_FIELDS) {
            const message = error.fieldErrors?.[name];
            if (message) form.setError(name, { type: "server", message });
          }
        },
      },
    );
  });

  const text = (
    name: (typeof SERVER_FIELDS)[number] & keyof WaybillFormInput,
    label: string,
    max: number,
    opts: { required?: boolean; mono?: boolean; hint?: string; autoFocus?: boolean } = {},
  ) => (
    <div>
      <Label
        htmlFor={`waybill-${name}`}
        className="text-ink-secondary mb-1 block text-xs font-medium"
      >
        {label} {opts.required && <span className="text-danger">*</span>}
      </Label>
      <Input
        id={`waybill-${name}`}
        autoFocus={opts.autoFocus}
        maxLength={max}
        autoComplete="off"
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `waybill-${name}-error` : undefined}
        className={`${fieldClass(!!errors[name])} ${opts.mono ? MONO : ""}`}
        {...form.register(name)}
      />
      {opts.hint && <p className="text-ink-tertiary mt-1 text-xs">{opts.hint}</p>}
      <FieldError id={`waybill-${name}-error`}>{errors[name]?.message}</FieldError>
    </div>
  );

  return (
    <FormDialog open onOpenChange={(next) => !next && !record.isPending && onClose()}>
      <FormDialogBody
        title={`${afterDeparture ? D.correctionTitle : D.title} · ${load.code}`}
        description={afterDeparture ? D.correctionDescription : D.description}
        submitLabel={afterDeparture ? D.correctionSubmit : D.submit}
        canSubmit={form.formState.isValid}
        isPending={record.isPending}
        error={serverError}
        onSubmit={() => void submit()}
        onCancel={() => !record.isPending && onClose()}
      >
        {text("waybillNo", D.waybillNo, SHIPPING_LIMITS.waybillNoMax, {
          required: true,
          mono: true,
          hint: D.waybillNoHint,
          autoFocus: true,
        })}
        {!afterDeparture && (
          <>
            {text("vehiclePlate", F.vehiclePlate, SHIPPING_LIMITS.vehiclePlateMax, { mono: true })}
            {text("driverName", F.driverName, SHIPPING_LIMITS.driverNameMax)}
            {text("driverPhone", F.driverPhone, SHIPPING_LIMITS.driverPhoneMax, { mono: true })}
          </>
        )}
        {afterDeparture && (
          <div>
            <Label
              htmlFor="waybill-reason"
              className="text-ink-secondary mb-1 block text-xs font-medium"
            >
              {D.reason} <span className="text-danger">*</span>
            </Label>
            <Textarea
              id="waybill-reason"
              rows={2}
              maxLength={SHIPPING_LIMITS.cancelReasonMax}
              aria-invalid={errors.reason ? true : undefined}
              className="border-border-default bg-bg-surface rounded-[var(--r-sm)] text-[0.8125rem]"
              {...form.register("reason")}
            />
            <FieldError>{errors.reason?.message}</FieldError>
          </div>
        )}
      </FormDialogBody>
    </FormDialog>
  );
}
