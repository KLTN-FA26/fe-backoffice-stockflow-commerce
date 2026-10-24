"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { LOAD_STATUS, SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { bookingInputSchema } from "@/features/shipping/input-schemas";
import { useBookLoad } from "@/features/shipping/ftl-mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { CarrierSelect } from "../CarrierSelect";
import { FieldError, MONO, fieldClass } from "../primitives";

import type { BookingFormInput, BookingValues, Load } from "@/features/shipping/types";

const D = UI_LABELS.shipping.ftl.bookDialog;
const SERVER_FIELDS = ["carrierId", "vehiclePlate", "driverName", "driverPhone"] as const;
type TextField = Exclude<(typeof SERVER_FIELDS)[number], "carrierId">;

/**
 * Đặt xe / sửa thông tin đặt xe (BE `POST loads/{id}/booking`): hãng bắt buộc, biển số và tài xế có thể
 * bổ sung sau. Đặt lại khi còn VEHICLE_BOOKED thay thông tin cũ. BE 409 CARRIER_INACTIVE /
 * SHIPMENT_OTHER_CARRIER (hãng khác hãng đã gán cho lô trên xe) hiện inline.
 */
export function BookingDialog({ load, onClose }: { load: Load; onClose: () => void }) {
  // Callback mức hook: ghi cache đưa chuyến sang VEHICLE_BOOKED có thể gỡ hộp thoại trước callback của `mutate`
  const book = useBookLoad({ onSuccess: onClose });
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<BookingFormInput, unknown, BookingValues>({
    resolver: zodResolver(bookingInputSchema),
    mode: "onChange",
    defaultValues: {
      carrierId: load.carrierId ?? "",
      vehiclePlate: load.vehiclePlate ?? "",
      driverName: load.driverName ?? "",
      driverPhone: load.driverPhone ?? "",
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
    book.mutate(
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
  const text = (name: TextField, label: string, max: number, mono = false) => (
    <div>
      <Label htmlFor={`book-${name}`} className="text-ink-secondary mb-1 block text-xs font-medium">
        {label}
      </Label>
      <Input
        id={`book-${name}`}
        maxLength={max}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `book-${name}-error` : undefined}
        className={`${fieldClass(!!errors[name])} ${mono ? MONO : ""}`}
        {...form.register(name)}
      />
      <FieldError id={`book-${name}-error`}>{errors[name]?.message}</FieldError>
    </div>
  );

  return (
    <FormDialog open onOpenChange={(next) => !next && !book.isPending && onClose()}>
      <FormDialogBody
        title={load.status === LOAD_STATUS.VEHICLE_BOOKED ? D.rebookTitle : D.title}
        description={D.description}
        submitLabel={D.submit}
        canSubmit={form.formState.isValid}
        isPending={book.isPending}
        error={serverError}
        onSubmit={() => void submit()}
        onCancel={() => !book.isPending && onClose()}
      >
        <div>
          <Label
            htmlFor="book-carrier"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            {D.carrier} <span className="text-danger">*</span>
          </Label>
          <Controller
            control={form.control}
            name="carrierId"
            render={({ field }) => (
              <CarrierSelect
                id="book-carrier"
                value={field.value || null}
                onChange={(carrierId) => field.onChange(carrierId ?? "")}
                currentName={load.carrierName}
              />
            )}
          />
          <FieldError>{errors.carrierId?.message}</FieldError>
        </div>
        {text("vehiclePlate", D.vehiclePlate, SHIPPING_LIMITS.vehiclePlateMax, true)}
        {text("driverName", D.driverName, SHIPPING_LIMITS.driverNameMax)}
        {text("driverPhone", D.driverPhone, SHIPPING_LIMITS.driverPhoneMax, true)}
      </FormDialogBody>
    </FormDialog>
  );
}
