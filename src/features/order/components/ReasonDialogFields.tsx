"use client";

import { useId } from "react";

import { ORDER_ACTION_LABELS } from "@/constants";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface OrderReasonOption {
  value: string;
  label: string;
}

const FIELD =
  "border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary focus:border-accent rounded-[var(--r-sm)] text-[0.8125rem]";

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-danger mt-1 text-xs">
      {message}
    </p>
  );
}

/** Ô chọn lý do (bắt buộc) của hộp thoại lý do + ghi chú. */
export function ReasonSelectField({
  label,
  options,
  value,
  error,
  onChange,
}: {
  label: string | undefined;
  options: readonly OrderReasonOption[];
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} className="text-[0.8125rem]">
        {label} <span className="text-danger">*</span>
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          autoFocus
          aria-invalid={error ? true : undefined}
          className={`${FIELD} mt-1 w-full`}
        >
          <SelectValue placeholder={ORDER_ACTION_LABELS.reasonPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((reason) => (
            <SelectItem key={reason.value} value={reason.value}>
              {reason.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError message={error} />
    </div>
  );
}

/** Ô ghi chú: đếm ký tự, Ctrl/Cmd+Enter gửi form. `hint` là dòng nhắc bên trái bộ đếm. */
export function NoteField({
  label,
  placeholder,
  value,
  max,
  required,
  autoFocus,
  hint,
  error,
  onChange,
}: {
  label: string;
  placeholder: string | undefined;
  value: string;
  max: number;
  required: boolean;
  autoFocus: boolean;
  hint: string | null;
  error: string | undefined;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} className="text-[0.8125rem]">
        {label} {required && <span className="text-danger">*</span>}
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
        maxLength={max}
        placeholder={placeholder}
        rows={3}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        className={`${FIELD} mt-1 max-h-40 min-h-20 resize-none`}
      />
      <div className="text-ink-tertiary mt-1 flex items-center justify-between text-xs tabular-nums">
        <span>{hint ?? " "}</span>
        <span>
          {value.length}/{max}
        </span>
      </div>
      <FieldError message={error} />
    </div>
  );
}
