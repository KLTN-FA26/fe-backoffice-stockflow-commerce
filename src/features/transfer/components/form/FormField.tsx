"use client";

import { Label } from "@/components/ui/label";

import { FieldError } from "../primitives";

/** Ô form: nhãn (+ dấu * bắt buộc) + nội dung + lỗi inline gắn `id`-error. */
export function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-ink-secondary mb-1 block text-xs font-medium">
        {label} {required && <span className="text-danger">*</span>}
      </Label>
      {children}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}
