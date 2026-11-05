"use client";

import { useRef } from "react";
import { cn } from "cn";
import { CheckCircle2, Loader2, ScanLine, XCircle } from "lucide-react";

import { useScanInput } from "@/hooks/use-scan-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ScanFeedback {
  tone: "positive" | "danger";
  message: string;
  /** Tăng mỗi lần quét — cùng một thông báo lặp lại vẫn chớp lại và được đọc lại. */
  seq?: number;
}

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
}

const FEEDBACK_CLASSES: Record<ScanFeedback["tone"], { field: string; text: string }> = {
  positive: {
    // Ô quét luôn focus → phải đè cả viền focus-visible, nếu không màu phản hồi không hiện
    field:
      "border-positive focus-visible:border-positive bg-[color-mix(in_srgb,var(--positive)_8%,transparent)] dark:bg-[color-mix(in_srgb,var(--positive)_14%,transparent)]",
    text: "text-positive",
  },
  danger: {
    field:
      "border-danger focus-visible:border-danger bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] dark:bg-[color-mix(in_srgb,var(--danger)_14%,transparent)]",
    text: "text-danger",
  },
};

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
}: ScanInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const scan = useScanInput(inputRef, { onScan, disabled });
  const tone = feedback ? FEEDBACK_CLASSES[feedback.tone] : null;
  const FeedbackIcon = feedback?.tone === "danger" ? XCircle : CheckCircle2;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-ink-primary text-[0.8125rem] font-semibold">
        {label}
      </Label>
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
            tone?.field,
          )}
        />
        {pending && (
          <Loader2 className="text-ink-tertiary absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
        )}
      </div>
      {/* Hai vùng live cố định (đổi `role` trên cùng một node thì trình đọc màn hình đọc không ổn
          định): lỗi → alert đọc ngay, đúng → status lịch sự. `key` theo `seq` để đọc lại khi lặp. */}
      {hint && (
        <span id={`${id}-hint`} className="sr-only">
          {hint}
        </span>
      )}
      <span role="alert" className="sr-only">
        {feedback?.tone === "danger" && <span key={feedback.seq}>{feedback.message}</span>}
      </span>
      <span role="status" className="sr-only">
        {feedback?.tone === "positive" && <span key={feedback.seq}>{feedback.message}</span>}
      </span>
      <p
        key={feedback?.seq}
        // Chỉ để nhìn: gợi ý đã đọc qua aria-describedby, kết quả quét đọc qua hai vùng live phía trên
        aria-hidden
        className={cn(
          "flex min-h-5 items-center gap-1.5 text-[0.8125rem]",
          tone?.text ?? "text-ink-tertiary",
          feedback && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150",
        )}
      >
        {feedback ? (
          <>
            <FeedbackIcon className="size-4 shrink-0" /> {feedback.message}
          </>
        ) : (
          hint
        )}
      </p>
    </div>
  );
}
