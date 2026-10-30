"use client";

import { Controller } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";

import type { Control, FieldPathByValue, FieldValues } from "react-hook-form";

/**
 * Ô tick boolean của form bản đồ — như `CheckboxField` dùng chung nhưng nhận `Control` của form có
 * schema biến đổi (input chuỗi → output số), vì `Control<In, unknown, Out>` không gán được cho `Control<In>`.
 */
export function FormCheck<TIn extends FieldValues, TOut extends FieldValues = TIn>({
  control,
  name,
  label,
  className,
}: {
  control: Control<TIn, unknown, TOut>;
  name: FieldPathByValue<TIn, boolean>;
  label: string;
  className?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label
          className={`text-ink-secondary flex items-center gap-2 text-[0.8125rem] ${className ?? ""}`}
        >
          <Checkbox
            ref={field.ref}
            checked={field.value === true}
            onBlur={field.onBlur}
            onCheckedChange={(value) => field.onChange(value === true)}
          />
          {label}
        </label>
      )}
    />
  );
}
