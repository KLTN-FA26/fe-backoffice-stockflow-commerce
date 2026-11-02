"use client";

import { useId } from "react";

import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { ComponentProps } from "react";

interface TextFieldProps extends Omit<ComponentProps<typeof Input>, "id"> {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

/** Ô nhập có nhãn + lỗi đọc được bởi trình đọc màn hình (htmlFor/id, aria-invalid, aria-describedby). */
export function TextField({ label, error, hint, required, ...inputProps }: TextFieldProps) {
  const id = useId();
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-ink-secondary text-xs font-medium">
        {label} {required && <span className="text-danger">*</span>}
      </Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={FORM_INPUT_CLASS}
        {...inputProps}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-ink-tertiary text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
