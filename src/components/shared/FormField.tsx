import { cn } from "cn";

import type { ReactNode } from "react";

/** Class ô nhập chuẩn (mẫu `supplier-form/fields.tsx`): viền token, focus theo brand của mode. */
export const FORM_INPUT_CLASS =
  "border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary focus-visible:border-brand focus-visible:ring-brand/20 h-9 rounded-[var(--r-sm)] text-[0.8125rem] shadow-none";

/** Props a11y cho input: id khớp label, aria-invalid + aria-describedby trỏ tới dòng lỗi / gợi ý. */
export function fieldA11y(id: string, error?: string, hint?: boolean) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
  };
}

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  className?: string;
  /** Input đã gắn `fieldA11y(id, error, !!hint)`. */
  children: ReactNode;
}

/** Một trường form: nhãn, ô nhập, gợi ý, lỗi inline (không alert). */
export function FormField({
  id,
  label,
  required,
  error,
  hint,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className="text-ink-secondary text-xs font-medium">
        {label}{" "}
        {required && (
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only">(bắt buộc)</span>}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-ink-tertiary text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-danger text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
