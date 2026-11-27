"use client";

import { cn } from "cn";

import type { LucideIcon } from "lucide-react";

export interface PageTabItem<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Số đếm cạnh nhãn (vd số PO); undefined = không hiện. */
  count?: number;
}

/**
 * Thanh tab dùng chung — kiểu gạch chân (như tab của Vercel): vạch kẻ mảnh suốt chiều ngang, tab
 * đang chọn chữ đậm màu + gạch dưới 2px màu chữ chính, tab khác chữ phụ, rê chuột thì đậm lên. Chỉ
 * chữ, không icon (`icon` giữ trong kiểu để chỗ gọi cũ không phải sửa). Không thêm `components/ui/tabs`
 * vì thư mục đó là shadcn nguyên bản (hook chặn sửa).
 *
 * Tab đang chọn do trang giữ — thường trên URL (`?tab=`, state-persistence.md). ARIA tablist + phím
 * mũi tên trái / phải (Mode A: thao tác không cần chuột). Đi cặp với `PageTabPanel` cùng `idPrefix`.
 */
export function PageTabs<T extends string>({
  tabs,
  value,
  onChange,
  idPrefix,
  ariaLabel,
  className,
}: {
  tabs: readonly PageTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  idPrefix: string;
  ariaLabel: string;
  className?: string;
}) {
  const index = tabs.findIndex((t) => t.value === value);
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "border-border-default text-ink-secondary mb-4 flex w-full items-end gap-1 border-b",
        className,
      )}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const next = tabs[(index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
        if (!next) return;
        onChange(next.value);
        document.getElementById(`${idPrefix}-tab-${next.value}`)?.focus();
      }}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            id={`${idPrefix}-tab-${tab.value}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${idPrefix}-panel-${tab.value}`}
            data-state={active ? "active" : "inactive"}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cn(
              "focus-visible:ring-border-strong relative -mb-px inline-flex h-10 items-center justify-center gap-1.5 rounded-t-md px-3 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none",
              // Gạch dưới tab đang chọn đè lên vạch kẻ của cả thanh
              "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full",
              active
                ? "text-ink-primary after:bg-ink-primary font-medium"
                : "hover:text-ink-primary after:bg-transparent",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums",
                  active ? "bg-brand text-ink-inverse" : "bg-bg-muted text-ink-tertiary",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function PageTabPanel({
  idPrefix,
  value,
  children,
}: {
  idPrefix: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${value}`}
      aria-labelledby={`${idPrefix}-tab-${value}`}
    >
      {children}
    </div>
  );
}
