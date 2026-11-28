"use client";

import { useRef } from "react";
import { cn } from "cn";
import { Loader2, ScanLine } from "lucide-react";

import { useScanInput } from "@/hooks/use-scan-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FEEDBACK_CLASSES, ScanInputMessages } from "./ScanInputMessages";

import type { ScanFeedback } from "./ScanInputMessages";

export type { ScanFeedback };

interface ScanInputProps {
  id: string;
  label: string;
  placeholder?: string;
  hint?: string;
  onScan: (code: string) => void;
  /**
   * Đang xử lý mã trước — chỉ hiện spinner, KHÔNG khoá ô: máy quét gõ liên tục, khoá ô sẽ làm rơi
   * ký tự của mã kế tiếp. Chống gửi trùng là việc của nơi nhận `onScan` (hàng đợi + loại trùng).
   */
  pending?: boolean;
  disabled?: boolean;
  maxLength?: number;
  /** Kết quả lần quét gần nhất — viền + dòng thông báo đổi màu, đọc qua `aria-live`. */
  feedback?: ScanFeedback | null;
  /**
   * Nút xác nhận cạnh ô (cao 48px như ô) cho người gõ tay không dùng máy quét — bấm là gửi mã đang gõ như Enter.
   * Vắng = chỉ Enter (máy quét gửi Enter sau mã).
   */
  submitLabel?: string;
}

/**
 * Ô quét mã vạch dùng chung cho màn quét mode A (module 03/05/07/08/09/10/11): ô lớn, font mono,
 * luôn focus, Enter gửi, Esc xoá; phản hồi đúng/sai bằng màu viền + chữ (không chỉ dựa vào màu:
 * kèm icon và câu thông báo).
 */
export function ScanInput({
  id,
  label,
  placeholder,
  hint,
  onScan,
  pending = false,
  disabled = false,
  maxLength,
  feedback,
  submitLabel,
}: ScanInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const scan = useScanInput(inputRef, { onScan, disabled });
  const tone = feedback ? FEEDBACK_CLASSES[feedback.tone] : null;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-ink-primary text-[0.8125rem] font-semibold">
        {label}
      </Label>
      <div className="space-y-2">
        <div className="relative">
          <ScanLine className="text-accent pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2" />
          <Input
            id={id}
            ref={inputRef}
            value={scan.value}
            onChange={scan.onChange}
            onKeyDown={scan.onKeyDown}
            onBlur={scan.onBlur}
            disabled={disabled}
            maxLength={maxLength}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            // Trỏ tới gợi ý (luôn có) — kết quả quét đã đọc qua vùng live, không đọc lặp lần hai
            aria-describedby={hint ? `${id}-hint` : undefined}
            className={cn(
              // `dark:bg-bg-surface`: Input shadcn có `dark:bg-input/30` đè nền + màu phản hồi ở dark mode
              "border-border-default bg-bg-surface dark:bg-bg-surface focus-visible:border-brand focus-visible:ring-brand/20 h-12 rounded-[var(--r-sm)] pr-10 pl-11 font-[family-name:var(--font-mono)] text-base tracking-wide md:text-base",
              // Gợi ý nhỏ, chữ thường: mã quét to dễ đọc, còn câu gợi ý không bị cắt cụt ở ô hẹp
              "placeholder:font-sans placeholder:text-sm placeholder:tracking-normal",
              tone?.field,
            )}
          />
          {pending && (
            <Loader2 className="text-ink-tertiary absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
          )}
        </div>
        {submitLabel && (
          <Button
            type="button"
            disabled={disabled}
            // Giữ focus ở ô quét: bấm nút không được cướp focus của máy quét
            onMouseDown={(event) => event.preventDefault()}
            onClick={scan.submit}
            className="bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse h-12 w-full rounded-[var(--r-sm)] px-4 text-sm"
          >
            {submitLabel}
          </Button>
        )}
      </div>
      <ScanInputMessages id={id} hint={hint} feedback={feedback} />
    </div>
  );
}
