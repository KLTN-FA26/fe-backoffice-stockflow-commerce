"use client";

import { X } from "lucide-react";

import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { ReactNode } from "react";

const ALL = "ALL";

/** Ô chọn MỘT giá trị của bộ lọc (BE nhận một enum): "ALL" = bỏ lọc. Không chứa nghiệp vụ. */
export function FilterSelect<T extends string>({
  id,
  label,
  allLabel,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  allLabel: string;
  value: T | null;
  options: readonly { value: T; label: string }[];
  onChange: (value: T | null) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="text-ink-secondary text-[0.8125rem]">
        {label}
      </Label>
      <Select
        value={value ?? ALL}
        onValueChange={(next) => onChange(next === ALL ? null : (next as T))}
      >
        <SelectTrigger
          id={id}
          className="border-border-default bg-bg-surface h-8 w-[11rem] rounded-[var(--r-sm)] text-[0.8125rem]"
        >
          <SelectValue />
        </SelectTrigger>
        <TitledSelectContent title={label}>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </TitledSelectContent>
      </Select>
    </div>
  );
}

/** Chip bộ lọc đang bật theo liên kết (khách / đơn) kèm nút bỏ. */
export function FilterChip({
  label,
  onClear,
  children,
}: {
  label: string;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <span className="border-border-default bg-bg-subtle text-ink-secondary inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
      {label}: {children}
      <button
        type="button"
        aria-label={`Bỏ lọc ${label.toLowerCase()}`}
        onClick={onClear}
        className="hover:text-ink-primary"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
