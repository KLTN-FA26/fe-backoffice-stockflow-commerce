"use client";

import { Controller } from "react-hook-form";

import { NumberInput } from "@/components/shared/NumberInput";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

/**
 * Ô số lượng (hàng lẻ, hàng giữ hộ) của form react-hook-form: nhóm nghìn khi hiện nhưng form vẫn nhận SỐ (`Number.NaN` khi
 * trống) như `register(..., { valueAsNumber: true })` trước đây — thân gửi BE không đổi (UX audit S01-7).
 */
export function QuantityField<T extends FieldValues>({
  control,
  name,
  inputProps,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  inputProps: Omit<React.ComponentProps<typeof NumberInput>, "value" | "onChange" | "grouped">;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <NumberInput
          grouped
          {...inputProps}
          ref={field.ref}
          onBlur={field.onBlur}
          value={typeof field.value !== "number" || Number.isNaN(field.value) ? "" : field.value}
          onChange={(event) =>
            field.onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))
          }
        />
      )}
    />
  );
}
