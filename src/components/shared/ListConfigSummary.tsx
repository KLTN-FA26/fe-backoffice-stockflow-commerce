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
}

/**
 * Thanh `Cấu hình` dưới toolbar danh sách Mode A (data-table-mode-a §3): mỗi nhóm cấu hình là một
 * badge có nút X để reset riêng, nút `Đặt lại` reset toàn bộ. Không chứa nghiệp vụ.
 */
export function ListConfigSummary({ items, onResetAll, resetDisabled }: ListConfigSummaryProps) {
  return (
    <div className="border-border-default mb-4 flex flex-wrap items-center gap-2 rounded-(--section-radius) border bg-(--summary-bg) px-3 py-2 text-[0.8125rem] shadow-(--card-shadow)">
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
        // Bấm được (có cấu hình khác mặc định) → xanh tươi + nền nhạt để người dùng thấy ngay
        className="text-ink-tertiary enabled:bg-dot-info/10 enabled:text-dot-info enabled:hover:bg-dot-info/15 enabled:hover:text-dot-info ml-auto rounded-[var(--r-sm)] enabled:font-semibold"
      >
        <RotateCcw className="size-3" />
        Đặt lại
      </Button>
    </div>
  );
}
