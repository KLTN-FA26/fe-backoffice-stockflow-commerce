"use client";

import { FormField, TextInput } from "./form-parts";

import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

const NUM = "text-right tabular-nums";
const MONO = "font-[family-name:var(--font-mono)] uppercase";

/**
 * Ô chữ / số của form bản đồ gắn react-hook-form, lỗi inline ngay dưới ô (api-conventions §4).
 * `kind`: `numeric` căn phải tabular-nums (số đo mét), `code` mono viết hoa (mã vị trí BR-10).
 */
export function FormText<TIn extends FieldValues, TOut extends FieldValues>({
  form,
  name,
  id,
  label,
  required,
  hint,
  kind = "text",
  autoFocus,
}: {
  form: UseFormReturn<TIn, unknown, TOut>;
  name: FieldPath<TIn>;
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  kind?: "text" | "numeric" | "code";
  autoFocus?: boolean;
}) {
  const error = form.getFieldState(name, form.formState).error?.message;
  return (
    <FormField id={id} label={label} required={required} hint={hint} error={error}>
      <TextInput
        id={id}
        error={error}
        autoComplete="off"
        autoFocus={autoFocus}
        inputMode={kind === "numeric" ? "decimal" : undefined}
        className={kind === "numeric" ? NUM : kind === "code" ? MONO : undefined}
        {...form.register(name)}
      />
    </FormField>
  );
}
