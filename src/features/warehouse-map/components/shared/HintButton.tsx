"use client";

import { CircleHelp } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Nút "?" nhỏ cạnh nhãn — bấm mới hiện lưu ý của ô / khối, để form gọn (không hiện sẵn mọi dòng gợi ý).
 * Popover (bấm) thay vì tooltip (rê chuột) để dùng được cả bằng bàn phím và cảm ứng.
 */
export function HintButton({ label, children }: { label: string; children: string }) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={`Lưu ý: ${label}`}
        className="text-ink-tertiary hover:text-ink-primary focus-visible:ring-border-strong inline-flex size-4 items-center justify-center rounded-full align-middle outline-none focus-visible:ring-2"
      >
        <CircleHelp className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="text-ink-secondary w-64 p-3 text-xs leading-relaxed"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
