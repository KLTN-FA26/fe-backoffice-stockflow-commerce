"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface MenuItem {
  key: string;
  label: string;
  /** Lý do đang tắt, hiện ngay dưới tên. */
  disabledReason?: string;
  run?: () => void;
}

/**
 * Menu `…` của đầu trang kế hoạch (S16-4): các thao tác phụ. Tên nút là nhãn; lý do khoá đọc qua mô tả (không lẫn vào tên
 * nút) và hiện ngay dưới tên chứ không chỉ khi rê chuột. Không có thao tác nào thì không hiện gì.
 */
export function PlanMoreMenu({ items, label }: { items: readonly MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" aria-label={label}>
          <MoreHorizontal className="size-3.5" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-60 flex-col gap-0.5 p-1">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-label={item.label}
            aria-describedby={item.disabledReason ? `plan-menu-${item.key}-why` : undefined}
            disabled={!item.run}
            onClick={() => {
              setOpen(false);
              item.run?.();
            }}
            className="hover:bg-bg-muted text-ink-primary flex flex-col items-start rounded-[var(--r-sm)] px-2.5 py-1.5 text-left text-[0.8125rem] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{item.label}</span>
            {item.disabledReason && (
              <span id={`plan-menu-${item.key}-why`} className="text-ink-tertiary text-xs">
                {item.disabledReason}
              </span>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
