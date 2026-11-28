"use client";

import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Textarea } from "@/components/ui/textarea";

import type { UseFormRegisterReturn } from "react-hook-form";

/** Ô ghi chú nhiều dòng gắn react-hook-form (nhãn, lỗi inline). Không chứa nghiệp vụ. */
export function NoteField({
  id,
  label = "Ghi chú",
  error,
  register,
  rows = 2,
  placeholder,
}: {
  id: string;
  label?: string;
  error?: string;
  register: UseFormRegisterReturn;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <FormField id={id} label={label} error={error}>
      <Textarea
        {...fieldA11y(id, error)}
        rows={rows}
        placeholder={placeholder}
        className={FORM_TEXTAREA_CLASS}
        {...register}
      />
    </FormField>
  );
}
