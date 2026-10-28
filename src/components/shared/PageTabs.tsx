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
 * Thanh tab dùng chung — kiểu Tabs mặc định của shadcn/ui (khung nền `bg.muted`, tab đang chọn là
 * ô nền `bg.surface` có bóng nhẹ), map sang token của dự án. Không thêm `components/ui/tabs` vì
 * thư mục đó là shadcn nguyên bản (hook chặn sửa) — chỉ lấy style.
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
        "bg-bg-muted text-ink-secondary mb-4 inline-flex h-9 w-fit items-center gap-0.5 rounded-lg p-[3px]",
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
        const Icon = tab.icon;
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
              "focus-visible:ring-border-strong inline-flex h-full items-center justify-center gap-1.5 rounded-md border border-transparent px-3 text-[0.8125rem] font-medium whitespace-nowrap transition-[color,box-shadow,background-color] focus-visible:ring-2 focus-visible:outline-none",
              active
                ? "bg-bg-surface text-ink-primary border-border-default shadow-sm"
                : "hover:text-ink-primary",
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums",
                  active ? "bg-brand text-ink-inverse" : "bg-bg-surface text-ink-tertiary",
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
