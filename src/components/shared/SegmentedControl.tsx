"use client";

import { cn } from "cn";

import type { ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

/**
 * Chọn một trong 2–4 giá trị cố định, hiện sẵn tất cả (một lần bấm) thay cho danh sách thả (UX audit R2). Là nhóm nút
 * chọn tròn (`role="radiogroup"`): một điểm dừng Tab, ←/→/↑/↓ đổi lựa chọn. Không chứa nghiệp vụ — nhãn và giá trị do
 * nơi dùng đưa vào. Quá 4 giá trị hoặc nhãn dài thì dùng `Select`.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  labelledBy,
  disabled,
  className,
  ...aria
}: {
  value: T | undefined;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  /** Tên nhóm cho trình đọc màn hình (hoặc `labelledBy` trỏ vào nhãn đã có trên trang). */
  label?: string;
  labelledBy?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const enabled = options.filter((option) => !option.disabled);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const move = (group: HTMLElement | null, from: number, step: 1 | -1) => {
    for (let i = 1; i <= options.length; i += 1) {
      const at = (from + step * i + options.length * i) % options.length;
      const next = options[at];
      if (next && !next.disabled) {
        onChange(next.value);
        // Focus đi theo lựa chọn (mẫu radiogroup của WAI-ARIA)
        group?.querySelectorAll<HTMLElement>('[role="radio"]')[at]?.focus();
        return;
      }
    }
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-disabled={disabled || undefined}
      className={cn(
        "border-border-default bg-bg-surface inline-flex max-w-full flex-wrap gap-0.5 rounded-[var(--r-md)] border p-0.5",
        className,
      )}
      {...aria}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        const off = disabled || option.disabled;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={off}
            // Một điểm dừng Tab cho cả nhóm: nút đang chọn (hoặc nút đầu dùng được khi chưa chọn)
            tabIndex={checked || (selectedIndex < 0 && option === enabled[0]) ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                move(event.currentTarget.parentElement, index, 1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                move(event.currentTarget.parentElement, index, -1);
              }
            }}
            className={cn(
              "min-h-8 rounded-[var(--r-sm)] px-3 text-[0.8125rem] font-medium transition-colors outline-none",
              "focus-visible:ring-brand/30 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
              checked
                ? "border-accent text-ink-primary border bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
                : "text-ink-secondary hover:bg-bg-muted border border-transparent",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
