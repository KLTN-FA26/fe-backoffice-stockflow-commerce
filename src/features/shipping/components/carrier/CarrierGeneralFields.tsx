"use client";

import { Controller } from "react-hook-form";

import { CARRIER_STATUSES, SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FieldError, MONO, fieldClass } from "../primitives";
import { CarrierChoice } from "./CarrierChoice";

import type { UseFormReturn } from "react-hook-form";
import type { CarrierFormInput, CarrierValues } from "@/features/shipping/types";

const C = UI_LABELS.shipping.waybill.carriers;
const FORM = C.form;
type TextField = "code" | "name" | "contactName" | "contactPhone";

/** Thông tin chung của hãng, hai cột như artboard: mã + tên, người liên hệ + điện thoại, trạng thái. */
export function CarrierGeneralFields({
  form,
  autoFocusCode,
}: {
  form: UseFormReturn<CarrierFormInput, unknown, CarrierValues>;
  autoFocusCode: boolean;
}) {
  const errors = form.formState.errors;
  const text = (
    name: TextField,
    label: string,
    max: number,
    opts: { required?: boolean; mono?: boolean; hint?: string; autoFocus?: boolean } = {},
  ) => (
    <div>
      <Label
        htmlFor={`carrier-${name}`}
        className="text-ink-secondary mb-1 block text-xs font-medium"
      >
        {label} {opts.required && <span className="text-danger">*</span>}
      </Label>
      <Input
        id={`carrier-${name}`}
        autoFocus={opts.autoFocus}
        maxLength={max}
        autoComplete="off"
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `carrier-${name}-error` : undefined}
        className={`${fieldClass(!!errors[name])} ${opts.mono ? MONO : ""}`}
        {...form.register(name)}
      />
      {opts.hint && <p className="text-ink-tertiary mt-1 text-xs">{opts.hint}</p>}
      <FieldError id={`carrier-${name}-error`}>{errors[name]?.message}</FieldError>
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
      {text("code", FORM.code, SHIPPING_LIMITS.carrierCodeMax, {
        required: true,
        mono: true,
        hint: FORM.codeHint,
        autoFocus: autoFocusCode,
      })}
      {text("name", FORM.name, SHIPPING_LIMITS.carrierNameMax, { required: true })}
      {text("contactName", FORM.contactName, SHIPPING_LIMITS.carrierContactNameMax)}
      {text("contactPhone", FORM.contactPhone, SHIPPING_LIMITS.carrierContactPhoneMax, {
        mono: true,
      })}
      <div className="sm:col-span-2">
        <p className="text-ink-secondary mb-1 text-xs font-medium">{FORM.status}</p>
        <Controller
          control={form.control}
          name="status"
          render={({ field }) => (
            <CarrierChoice
              id="carrier-status"
              label={FORM.status}
              value={field.value}
              onChange={field.onChange}
              options={CARRIER_STATUSES.map((status) => ({
                value: status,
                label: C.status[status],
              }))}
            />
          )}
        />
      </div>
    </div>
  );
}
