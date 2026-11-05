"use client";

import { Checkbox } from "@/components/ui/checkbox";

export interface ChecklistItem {
  value: string;
  label: string;
  hint?: string;
}

interface ChecklistProps {
  legend: string;
  items: readonly ChecklistItem[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  disabled?: boolean;
  /** Hiện khi `items` rỗng (vd chưa có kho nào). */
  emptyText: string;
  error?: string;
}

/** Danh sách ô tick nhiều lựa chọn (vai trò, kho) — mỗi ô có nhãn riêng để trình đọc màn hình và test tìm theo tên. */
export function Checklist({
  legend,
  items,
  selected,
  onToggle,
  disabled,
  emptyText,
  error,
}: ChecklistProps) {
  const chosen = new Set(selected);
  return (
    <fieldset className="m-0 min-w-0 space-y-1.5 border-0 p-0" disabled={disabled}>
      <legend className="text-ink-secondary mb-1 text-xs font-medium">{legend}</legend>
      {items.length === 0 ? (
        <p className="text-ink-tertiary text-xs">{emptyText}</p>
      ) : (
        <ul className="border-border-default max-h-44 space-y-1 overflow-y-auto rounded-[var(--r-sm)] border p-2">
          {items.map((item) => (
            <li key={item.value}>
              <label className="text-ink-primary flex cursor-pointer items-start gap-2 text-[0.8125rem]">
                <Checkbox
                  checked={chosen.has(item.value)}
                  onCheckedChange={() => onToggle(item.value)}
                  aria-label={item.label}
                  className="mt-0.5"
                />
                <span>
                  {item.label}
                  {item.hint && (
                    <span className="text-ink-tertiary block text-xs">{item.hint}</span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-danger text-xs">{error}</p>}
    </fieldset>
  );
}
