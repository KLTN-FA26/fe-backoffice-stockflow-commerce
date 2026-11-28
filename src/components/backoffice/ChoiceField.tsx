"use client";

import { FormField } from "@/components/shared/FormField";
import { FormSelect } from "@/components/shared/FormSelect";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/combobox-select";

/** Ô chọn một giá trị cố định trong form (lý do, trạng thái…): combobox + nhãn + lỗi inline. Không chứa nghiệp vụ. */
export function ChoiceField({
  id,
  label,
  value,
  onChange,
  options,
  error,
  hint,
  required,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <FormField id={id} label={label} required={required} error={error} hint={hint}>
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
