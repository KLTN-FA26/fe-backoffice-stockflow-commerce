"use client";

import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { ComponentProps, ReactNode } from "react";

/** Lỗi inline dưới ô — `id` để ô nhập trỏ `aria-describedby` tới. */
export function FieldError({ id, children }: { id?: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-danger mt-1 text-xs">
      {children}
    </p>
  );
}

/** Nhãn + ô nhập + gợi ý / lỗi của một trường form. */
export function FormField({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-ink-secondary mb-1 block text-xs font-medium">
        {label} {required && <span className="text-danger">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-ink-tertiary mt-1 text-xs">{hint}</p>}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

/** Ô nhập Mode A gắn lỗi cho trình đọc màn hình. */
export function TextInput({
  id,
  error,
  className,
  ...props
}: ComponentProps<typeof Input> & { id: string; error?: string }) {
  return (
    <Input
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={`${FORM_INPUT_CLASS} ${className ?? ""}`}
      {...props}
    />
  );
}
