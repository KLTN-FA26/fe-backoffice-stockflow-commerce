"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FieldError, MONO, fieldClass } from "../primitives";

import type { UseFormReturn } from "react-hook-form";
import type { HandoverFormInput, HandoverValues } from "@/features/shipping/types";

export type HandoverTextName =
  "driverName" | "carrierRepresentative" | "vehiclePlate" | "driverPhone" | "signatureRef";

/** Một ô chữ của hộp thoại bàn giao: nhãn (dấu * khi bắt buộc), lỗi inline của zod / BE dưới ô. */
export function HandoverTextField({
  form,
  name,
  label,
  max,
  required,
  mono,
  autoFocus,
}: {
  form: UseFormReturn<HandoverFormInput, unknown, HandoverValues>;
  name: HandoverTextName;
  label: string;
  max: number;
  required?: boolean;
  mono?: boolean;
  autoFocus?: boolean;
}) {
  const error = form.formState.errors[name]?.message;
  return (
    <div>
      <Label
        htmlFor={`handover-${name}`}
        className="text-ink-secondary mb-1 block text-xs font-medium"
      >
        {label} {required && <span className="text-danger">*</span>}
      </Label>
      <Input
        id={`handover-${name}`}
        autoFocus={autoFocus}
        maxLength={max}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `handover-${name}-error` : undefined}
        className={`${fieldClass(!!error)} ${mono ? MONO : ""}`}
        {...form.register(name)}
      />
      <FieldError id={`handover-${name}-error`}>{error}</FieldError>
    </div>
  );
}
