"use client";

import { RotateCcw, Settings2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";

export interface ListSummaryItem {
  label: string;
  value: ReactNode;
  active?: boolean;
  onClear?: () => void;
  clearLabel?: string;
}

interface ListConfigSummaryProps {
  items: ListSummaryItem[];
  onResetAll: () => void;
  resetDisabled?: boolean;
  /** Nút lọc / ẩn hiện cột của toolbar khi trang đặt chúng ở thanh này (`controlsIn="summary"`). */
  controls?: ReactNode;
}

/**
 * Thanh `Cấu hình` dưới toolbar danh sách Mode A (data-table-mode-a §3): mỗi nhóm cấu hình là một
 * badge có nút X để reset riêng, nút `Đặt lại` reset toàn bộ. Không chứa nghiệp vụ.
 */
export function ListConfigSummary({
  items,
  onResetAll,
  resetDisabled,
  controls,
}: ListConfigSummaryProps) {
  if (controls) {
    return (
      <SummaryWithControls
        items={items}
        onResetAll={onResetAll}
        resetDisabled={resetDisabled}
        controls={controls}
      />
    );
  }
  return (
    <div className="border-border-default relative mb-3 flex flex-wrap items-center gap-2 rounded-(--section-radius) border bg-(--summary-bg) px-3 py-2 text-[0.8125rem] shadow-(--card-shadow)">
      <div className="text-ink-primary mr-1 flex items-center gap-2 font-medium">
        <Settings2 className="text-accent size-3.5" />
        Cấu hình
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
        {items.map((item) => (
          <Badge
            key={item.label}
            variant="outline"
            className="bg-bg-subtle text-ink-secondary gap-1"
          >
            {item.label}: {item.value}
            {item.active && item.onClear && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={item.onClear}
                aria-label={item.clearLabel ?? `Xoá ${item.label}`}
                className="text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary size-4 rounded-full p-0"
              >
                <X className="size-3" />
              </Button>
            )}
          </Badge>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={onResetAll}
        disabled={resetDisabled}
        // Bấm được (có cấu hình khác mặc định) → chữ xanh link (accent-text, ≥ 4.5:1) + nền xanh tươi nhạt
        className="text-ink-tertiary enabled:bg-dot-info/10 enabled:text-accent-text enabled:hover:bg-dot-info/15 enabled:hover:text-accent-text ml-auto rounded-[var(--r-sm)] enabled:font-semibold"
      >
        <RotateCcw className="size-3" />
        Đặt lại
      </Button>
    </div>
  );
}

/**
 * Kiểu Vercel (trang đặt nút lọc / ẩn hiện cột ở đây): không khung, không chữ "Cấu hình" — nút lọc
 * / ẩn hiện cột (viên bo tròn có chữ) đứng đầu, mỗi cấu hình là một viên viền nét đứt "Nhãn **Giá trị**", `Đặt lại` bên phải.
 * `relative` để bảng "Bộ lọc" canh theo hàng này.
 */
function SummaryWithControls({
  items,
  onResetAll,
  resetDisabled,
  controls,
}: ListConfigSummaryProps) {
  return (
    <div className="relative mb-3 flex flex-wrap items-center gap-2 text-[0.8125rem]">
      <div className="flex items-center gap-2">{controls}</div>
      {items.map((item) => (
        <span
          key={item.label}
          className="border-border-strong text-ink-tertiary inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed px-3"
        >
          {item.label}
          <span className="text-ink-primary font-medium">{item.value}</span>
          {item.active && item.onClear && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={item.onClear}
              aria-label={item.clearLabel ?? `Xoá ${item.label}`}
              className="text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary -mr-1 size-5 rounded-full p-0"
            >
              <X className="size-3" />
            </Button>
          )}
        </span>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={onResetAll}
        disabled={resetDisabled}
        className="text-ink-tertiary enabled:text-accent-text enabled:hover:bg-dot-info/10 enabled:hover:text-accent-text ml-auto rounded-full enabled:font-semibold"
      >
        <RotateCcw className="size-3" />
        Đặt lại
      </Button>
    </div>
  );
}
