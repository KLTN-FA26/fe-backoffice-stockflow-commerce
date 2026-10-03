/** Primitive form nhỏ cho wizard NCC — label gắn input (htmlFor/id) + lỗi đọc được bởi screen reader. */

import type { SupplierFormValues } from "../../types";

export function fieldId(name: keyof SupplierFormValues): string {
  return `supplier-${name}`;
}

function errorId(name: keyof SupplierFormValues): string {
  return `${fieldId(name)}-error`;
}

/** Props a11y cho input: id khớp label, aria-invalid + aria-describedby trỏ tới dòng lỗi. */
export function fieldA11y(name: keyof SupplierFormValues, message?: string) {
  return {
    id: fieldId(name),
    "aria-invalid": message ? true : undefined,
    "aria-describedby": message ? errorId(name) : undefined,
  };
}

export function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="text-ink-secondary text-xs font-medium">
      {children} {required && <span className="text-danger">*</span>}
    </label>
  );
}

export function FieldError({
  name,
  message,
}: {
  name: keyof SupplierFormValues;
  message?: string;
}) {
  if (!message) return null;
  return (
    <p id={errorId(name)} className="text-danger mt-1 text-xs">
      {message}
    </p>
  );
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-ink-tertiary mt-1 text-xs">{children}</p>;
}

export const inputCls =
  "border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary focus-visible:border-brand focus-visible:ring-brand/20 h-9 rounded-[var(--r-sm)] text-[0.8125rem] shadow-none";
