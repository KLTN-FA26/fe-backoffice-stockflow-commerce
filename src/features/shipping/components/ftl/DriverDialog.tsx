"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { SHIPPING_LIMITS, TOAST_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { useRecordDriver } from "@/features/shipping/ftl-mutations";
import { driverInputSchema } from "@/features/shipping/input-schemas";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { toast } from "@/components/shared/Toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FieldError, MONO, fieldClass } from "../primitives";

import type { DriverFormInput, DriverValues, Load } from "@/features/shipping/types";

const D = UI_LABELS.shipping.ftl.driverDialog;
const SERVER_FIELDS = ["driverName", "driverPhone"] as const;

/**
 * Nhập tài xế của xe đã đặt / đang xếp (WF4-DRIVER; BE `PUT loads/{id}/driver`, quyền `fulfillment-dispatch:UPDATE`): tên
 * bắt buộc, SĐT tuỳ chọn, không đụng mã vận đơn — dùng được cả cho hãng đặt xe qua API. Lỗi 409 INVALID_LOAD_TRANSITION
 * (xe đã rời kho / đã huỷ) và lỗi ô hiện inline. Backend phải re-check quyền + trạng thái.
 */
export function DriverDialog({ load, onClose }: { load: Load; onClose: () => void }) {
  const record = useRecordDriver({
    onSuccess: () => {
      toast.success(TOAST_MESSAGES.shipping.driverRecorded);
      onClose();
    },
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<DriverFormInput, unknown, DriverValues>({
    resolver: zodResolver(driverInputSchema),
    mode: "onChange",
    defaultValues: { driverName: load.driverName ?? "", driverPhone: load.driverPhone ?? "" },
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
    record.mutate(
      { loadId: load.loadId, values },
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
    name: (typeof SERVER_FIELDS)[number],
    label: string,
    max: number,
    opts: { required?: boolean; mono?: boolean; autoFocus?: boolean } = {},
  ) => (
    <div>
      <Label
        htmlFor={`driver-${name}`}
        className="text-ink-secondary mb-1 block text-xs font-medium"
      >
        {label} {opts.required && <span className="text-danger">*</span>}
      </Label>
      <Input
        id={`driver-${name}`}
        autoFocus={opts.autoFocus}
        maxLength={max}
        autoComplete="off"
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `driver-${name}-error` : undefined}
        className={`${fieldClass(!!errors[name])} ${opts.mono ? MONO : ""}`}
        {...form.register(name)}
      />
      <FieldError id={`driver-${name}-error`}>{errors[name]?.message}</FieldError>
    </div>
  );

  return (
    <FormDialog open onOpenChange={(next) => !next && !record.isPending && onClose()}>
      <FormDialogBody
        title={`${load.driverName ? D.editTitle : D.title} · ${load.code}`}
        description={D.description}
        submitLabel={D.submit}
        canSubmit={form.formState.isValid}
        isPending={record.isPending}
        error={serverError}
        onSubmit={() => void submit()}
        onCancel={() => !record.isPending && onClose()}
      >
        {text("driverName", D.driverName, SHIPPING_LIMITS.driverNameMax, {
          required: true,
          autoFocus: true,
        })}
        {text("driverPhone", D.driverPhone, SHIPPING_LIMITS.driverPhoneMax, { mono: true })}
      </FormDialogBody>
    </FormDialog>
  );
}
