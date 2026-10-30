"use client";

import { Controller } from "react-hook-form";

import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { FormField } from "./form-parts";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

/** Ô chọn một giá trị trong form bản đồ kho — nhãn tiếng Việt theo từng giá trị enum BE. */
export function SelectField<TIn extends FieldValues, TOut extends FieldValues = TIn>({
  control,
  name,
  id,
  label,
  options,
  hint,
  required = true,
}: {
  control: Control<TIn, unknown, TOut>;
  name: FieldPath<TIn>;
  id: string;
  label: string;
  options: readonly { value: string; label: string }[];
  hint?: string;
  required?: boolean;
}) {
  return (
    <FormField id={id} label={label} required={required} hint={hint}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={String(field.value)} onValueChange={field.onChange}>
            <SelectTrigger id={id} className={FORM_SELECT_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <TitledSelectContent title={label}>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </TitledSelectContent>
          </Select>
        )}
      />
    </FormField>
  );
}

/** `Record<enum, nhãn>` → danh sách option theo đúng thứ tự enum. */
export const optionsOf = <K extends string>(values: readonly K[], labels: Record<K, string>) =>
  values.map((value) => ({ value, label: labels[value] }));
