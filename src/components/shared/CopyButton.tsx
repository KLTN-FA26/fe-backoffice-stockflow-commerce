"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "cn";

import { CLIPBOARD_LABELS } from "@/constants";

import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

/** Thời gian giữ dấu tích sau khi sao chép. */
const COPIED_MS = 1500;

/**
 * Nút icon sao chép một mã (LPN, mã vị trí…) — để dán vào ô quét khi không có máy quét, thay vì phải in tem. Không
 * nghiệp vụ: nhận chuỗi qua props. `navigator.clipboard` vắng ngoài secure context → báo lỗi, không im lặng.
 */
export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      toast.error(CLIPBOARD_LABELS.failed);
    }
  };

  const Icon = copied ? Check : Copy;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={copied ? CLIPBOARD_LABELS.copied(value) : CLIPBOARD_LABELS.copy(value)}
      title={CLIPBOARD_LABELS.copy(value)}
      onClick={(event) => {
        // Nút nằm trong dòng bảng bấm được — không mở chi tiết khi chỉ sao chép
        event.stopPropagation();
        void copy();
      }}
      className={cn("text-ink-tertiary hover:text-ink-primary size-6 shrink-0", className)}
    >
      <Icon className={cn("size-3.5", copied && "text-dot-positive")} aria-hidden />
    </Button>
  );
}
