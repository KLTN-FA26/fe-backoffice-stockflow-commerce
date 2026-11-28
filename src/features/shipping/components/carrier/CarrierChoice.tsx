"use client";

import { cn } from "cn";

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Chọn một trong 2–4 giá trị cố định, hiện sẵn tất cả (một lần bấm) thay cho danh sách thả (UX audit R2, S01-6): nhóm nút
 * chọn tròn `role="radiogroup"`, ←/→ đổi lựa chọn. Bản CỤC BỘ cho biểu mẫu hãng — PR #308 thêm `SegmentedControl` dùng
 * chung (`components/shared`), khi hai PR cùng vào thì thay bằng bản đó và xoá file này.
 */
export function CarrierChoice<T extends string>({
  value,
  onChange,
  options,
  label,
  id,
}: {
  value: T | undefined;
  onChange: (value: T) => void;
  options: readonly ChoiceOption<T>[];
  label: string;
  id?: string;
}) {
  const move = (from: number, step: 1 | -1, group: HTMLElement) => {
    const at = (from + step + options.length) % options.length;
    const next = options[at];
    if (!next) return;
    onChange(next.value);
    group.querySelectorAll<HTMLElement>('[role="radio"]')[at]?.focus();
  };
  const selected = options.findIndex((option) => option.value === value);
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      className="border-border-default bg-bg-surface inline-flex max-w-full flex-wrap gap-0.5 rounded-[var(--r-md)] border p-0.5"
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={index === Math.max(selected, 0) ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            const group = event.currentTarget.parentElement;
            if (!group) return;
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault();
              move(index, 1, group);
            } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault();
              move(index, -1, group);
            }
          }}
          className={cn(
            "rounded-[var(--r-sm)] px-3 py-1 text-[0.8125rem] transition-colors",
            option.value === value
              ? "bg-brand text-ink-inverse font-medium"
              : "text-ink-secondary hover:bg-bg-muted",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
