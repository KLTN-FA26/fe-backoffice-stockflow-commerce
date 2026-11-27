"use client";

import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_INPUT_CLASS, FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { UseFormRegisterReturn } from "react-hook-form";

const MONO = "font-[family-name:var(--font-mono)] tabular-nums";

/** Ô số (tiền VND / số ngày) — gõ số nguyên, căn phải. */
export function NumberField({
  id,
  label,
  required,
  error,
  hint,
  register,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  register: UseFormRegisterReturn;
}) {
  return (
    <FormField id={id} label={label} required={required} error={error} hint={hint}>
      <Input
        {...fieldA11y(id, error, !!hint)}
        inputMode="numeric"
        autoComplete="off"
        className={`${FORM_INPUT_CLASS} ${MONO} text-right`}
        {...register}
      />
    </FormField>
  );
}

export function TextAreaField({
  id,
  label,
  required,
  error,
  hint,
  register,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  register: UseFormRegisterReturn;
}) {
  return (
    <FormField id={id} label={label} required={required} error={error} hint={hint}>
      <Textarea
        {...fieldA11y(id, error, !!hint)}
        rows={3}
        className={FORM_TEXTAREA_CLASS}
        {...register}
      />
    </FormField>
  );
}
