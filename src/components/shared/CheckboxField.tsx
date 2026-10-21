"use client";

import { cn } from "cn";
import { Controller } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";

import type { Control, FieldPathByValue, FieldValues } from "react-hook-form";

/**
 * Ô tick boolean gắn react-hook-form bằng shadcn `Checkbox` — dùng thay `<input type="checkbox"
 * {...register()}>` (Checkbox của shadcn là nút Radix, không nhận `register` trực tiếp).
 * Không có `label` khi nhãn đã nằm ở `Field` bao ngoài (truyền `id` để nhãn đó gắn vào ô).
 */
export function CheckboxField<T extends FieldValues>({
  control,
  name,
  label,
  id,
  className,
  onCheckedChange,
}: {
  control: Control<T>;
  name: FieldPathByValue<T, boolean>;
  label?: string;
  id?: string;
  className?: string;
  /** Hiệu ứng phụ sau khi đổi giá trị (vd xoá ô phụ thuộc). */
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const box = (
          <Checkbox
            id={id}
            ref={field.ref}
            checked={field.value === true}
            onBlur={field.onBlur}
            onCheckedChange={(value) => {
              const checked = value === true;
              field.onChange(checked);
              onCheckedChange?.(checked);
            }}
          />
        );
        if (!label) return box;
        return (
          <label
            className={cn("text-ink-secondary flex items-center gap-2 text-[0.8125rem]", className)}
          >
            {box}
            {label}
          </label>
        );
      }}
    />
  );
}
