"use client";

import { Controller } from "react-hook-form";

import { SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldError, MONO, fieldClass } from "../primitives";

import type { UseFormReturn } from "react-hook-form";
import type { HandoverFormInput, HandoverValues, Load } from "@/features/shipping/types";

const H = UI_LABELS.shipping.handover;
export const HANDOVER_SERVER_FIELDS = [
  "carrierRepresentative",
  "vehiclePlate",
  "driverPhone",
  "signatureRef",
  "note",
] as const;

type TextField = (typeof HANDOVER_SERVER_FIELDS)[number];

/** Các ô của biên bản bàn giao: người ký bên hãng, xe, SĐT, mã biên bản giấy, ghi chú, xác nhận đã ký. */
export function HandoverFields({
  form,
  load,
}: {
  form: UseFormReturn<HandoverFormInput, unknown, HandoverValues>;
  load: Load;
}) {
  const errors = form.formState.errors;
  const text = (
    name: Exclude<TextField, "note">,
    label: string,
    max: number,
    opts: { required?: boolean; mono?: boolean; autoFocus?: boolean } = {},
  ) => (
    <div>
      <Label
        htmlFor={`handover-${name}`}
        className="text-ink-secondary mb-1 block text-xs font-medium"
      >
        {label} {opts.required && <span className="text-danger">*</span>}
      </Label>
      <Input
        id={`handover-${name}`}
        autoFocus={opts.autoFocus}
        maxLength={max}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `handover-${name}-error` : undefined}
        className={`${fieldClass(!!errors[name])} ${opts.mono ? MONO : ""}`}
        {...form.register(name)}
      />
      <FieldError id={`handover-${name}-error`}>{errors[name]?.message}</FieldError>
    </div>
  );

  return (
    <>
      {text("carrierRepresentative", H.representative, SHIPPING_LIMITS.carrierRepresentativeMax, {
        required: true,
        autoFocus: true,
      })}
      {text("vehiclePlate", H.vehiclePlate, SHIPPING_LIMITS.vehiclePlateMax, {
        required: !load.vehiclePlate,
        mono: true,
      })}
      {text("driverPhone", H.driverPhone, SHIPPING_LIMITS.driverPhoneMax, { mono: true })}
      {text("signatureRef", H.signatureRef, SHIPPING_LIMITS.signatureRefMax)}
      <p className="text-ink-tertiary -mt-2 text-xs">{H.signatureRefHint}</p>
      <div>
        <Label
          htmlFor="handover-note"
          className="text-ink-secondary mb-1 block text-xs font-medium"
        >
          {H.note}
        </Label>
        <Textarea
          id="handover-note"
          rows={2}
          maxLength={SHIPPING_LIMITS.noteMax}
          aria-invalid={errors.note ? true : undefined}
          className="border-border-default bg-bg-surface rounded-[var(--r-sm)] text-[0.8125rem]"
          {...form.register("note")}
        />
        <FieldError>{errors.note?.message}</FieldError>
      </div>
      <Controller
        control={form.control}
        name="signed"
        render={({ field }) => (
          <label htmlFor="handover-signed" className="flex items-center gap-2 text-[0.8125rem]">
            <Checkbox
              id="handover-signed"
              aria-describedby="handover-signed-hint"
              checked={field.value === true}
              onCheckedChange={(checked) => field.onChange(checked === true ? true : undefined)}
            />
            <span className="text-ink-primary">{H.signedConfirm}</span>
          </label>
        )}
      />
      {/* Nút xác nhận khoá tới khi tick — nói rõ vì sao */}
      <p id="handover-signed-hint" className="text-ink-tertiary -mt-1 pl-6 text-xs">
        {H.signedHint}
      </p>
    </>
  );
}
