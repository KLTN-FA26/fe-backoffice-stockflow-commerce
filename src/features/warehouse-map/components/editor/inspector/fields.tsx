"use client";

import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FieldError, FormField, TextInput } from "../../shared/form-parts";

import type { ReactNode } from "react";

/** Khối trong bảng thông số: tiêu đề nhỏ + lưới ô nhập + lỗi luật của cả khối. */
export function Section({
  title,
  error,
  children,
}: {
  title: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2 border-t border-(--table-line) pt-3">
      <h3 className="text-ink-secondary text-xs font-semibold">{title}</h3>
      {children}
      <FieldError>{error}</FieldError>
    </section>
  );
}

/** Ô chữ commit mỗi lần gõ (tên, mô tả, mã); `code` = mono viết hoa (BR-10). */
export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  code = false,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  code?: boolean;
  disabled?: boolean;
}) {
  return (
    <FormField id={id} label={label} error={error} hint={hint}>
      <TextInput
        id={id}
        error={error}
        autoComplete="off"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(code ? event.target.value.toUpperCase() : event.target.value)}
        className={code ? "font-[family-name:var(--font-mono)] uppercase" : undefined}
      />
    </FormField>
  );
}

export function ChoiceField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <FormField id={id} label={label}>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          const option = options.find((candidate) => candidate.value === next);
          if (option) onChange(option.value);
        }}
      >
        <SelectTrigger id={id} className={FORM_SELECT_CLASS}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

export function CheckField({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onChange(next === true)}
      />
      <Label htmlFor={id} className="text-ink-primary text-xs font-normal">
        {label}
      </Label>
    </div>
  );
}
