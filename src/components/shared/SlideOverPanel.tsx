"use client";

import { Dialog as SheetPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";

interface SlideOverPanelProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Tiêu đề là mã định danh (số đơn, SKU) → font mono như OrderDetailPanel/SkuDetailPanel. */
  monoTitle?: boolean;
  subtitle?: ReactNode;
  /** Badge trạng thái cạnh nút đóng. */
  badge?: ReactNode;
  children: ReactNode;
}

/**
 * Panel chi tiết trượt từ phải — dựng từ Radix Dialog (cùng primitive với `components/ui/sheet`):
 * focus trap, trả focus khi đóng, Esc / bấm nền để đóng, `aria-modal`.
 * Không dùng thẳng `SheetContent` vì overlay của nó không nhận class (z-50, nền /10) và độ rộng
 * bị khoá `sm:max-w-sm` — panel cần khớp OrderDetailPanel/SkuDetailPanel: overlay z 900 nền /20,
 * panel z 1100 (design-tokens) rộng `max-w-md`. Không chứa nghiệp vụ — nội dung qua `children`.
 */
export function SlideOverPanel({
  open,
  onClose,
  title,
  monoTitle = false,
  subtitle,
  badge,
  children,
}: SlideOverPanelProps) {
  return (
    <SheetPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className="data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 z-[900] bg-black/20 backdrop-blur-xs motion-reduce:animate-none" />
        <SheetPrimitive.Content className="border-border-default bg-bg-surface text-ink-primary data-open:animate-in data-open:slide-in-from-right-10 data-closed:animate-out data-closed:slide-out-to-right-10 fixed inset-y-0 right-0 z-[1100] flex h-full w-full max-w-md flex-col border-l shadow-[var(--sh-lg)] motion-reduce:animate-none">
          <div className="border-border-default flex items-center justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <SheetPrimitive.Title
                className={cn(
                  "text-ink-primary text-sm font-semibold",
                  monoTitle && "font-[family-name:var(--font-mono)]",
                )}
              >
                {title}
              </SheetPrimitive.Title>
              <SheetPrimitive.Description
                className={subtitle ? "text-ink-secondary mt-0.5 truncate text-xs" : "sr-only"}
              >
                {subtitle ?? "Chi tiết"}
              </SheetPrimitive.Description>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {badge}
              <SheetPrimitive.Close asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Đóng">
                  <X className="size-4" />
                </Button>
              </SheetPrimitive.Close>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}
