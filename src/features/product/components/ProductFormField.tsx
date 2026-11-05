import type { ReactNode } from "react";

export function ProductFormField({
  children,
  error,
  hint,
  htmlFor,
  label,
  required,
}: {
  children: ReactNode;
  error?: string;
  hint?: string;
  htmlFor?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-ink-secondary mb-1 block text-xs font-medium">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-ink-tertiary mt-1 text-xs">{hint}</p>}
      {error && (
        <p className="text-danger mt-1 text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
