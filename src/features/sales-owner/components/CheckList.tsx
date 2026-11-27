"use client";

import { Checkbox } from "@/components/ui/checkbox";

/** Danh sách ô tick chọn nhiều (Sale nhận, khách cần chuyển) — nhóm có nhãn, lỗi inline. */
export function CheckList({
  id,
  label,
  options,
  selected,
  onChange,
  error,
  empty,
}: {
  id: string;
  label: string;
  options: readonly { value: string; label: string }[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  error?: string;
  empty?: string;
}) {
  const toggle = (value: string, on: boolean) =>
    onChange(on ? [...selected, value] : selected.filter((item) => item !== value));
  return (
    <fieldset
      className="m-0 min-w-0 border-0 p-0"
      aria-describedby={error ? `${id}-error` : undefined}
    >
      <legend className="text-ink-secondary mb-1 text-xs font-medium">{label}</legend>
      {options.length === 0 && empty && <p className="text-ink-tertiary text-xs">{empty}</p>}
      <div className="border-border-default max-h-44 space-y-1 overflow-y-auto rounded-(--field-radius) border p-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="text-ink-primary flex items-center gap-2 text-[0.8125rem]"
          >
            <Checkbox
              checked={selected.includes(option.value)}
              onCheckedChange={(value) => toggle(option.value, value === true)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-danger mt-1 text-xs">
          {error}
        </p>
      )}
    </fieldset>
  );
}
