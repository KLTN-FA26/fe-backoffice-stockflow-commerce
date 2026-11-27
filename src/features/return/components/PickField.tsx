"use client";

import { FormField } from "@/components/shared/FormField";
import { FormSelect } from "@/components/shared/FormSelect";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/combobox-select";

/** Ô chọn một giá trị trong form (Select + nhãn + lỗi), báo "không có lựa chọn" khi danh sách rỗng. */
export function PickField({
  id,
  label,
  placeholder,
  required,
  error,
  value,
  onChange,
  options,
  empty,
}: {
  id: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  /** Câu hiện dưới ô khi không có lựa chọn nào. */
  empty?: string;
}) {
  return (
    <FormField
      id={id}
      label={label}
      required={required}
      error={error}
      hint={options.length === 0 ? empty : undefined}
    >
      <FormSelect value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id} aria-invalid={!!error} className={FORM_SELECT_CLASS}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </FormSelect>
    </FormField>
  );
}
