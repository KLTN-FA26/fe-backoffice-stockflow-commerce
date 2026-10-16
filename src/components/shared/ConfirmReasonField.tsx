"use client";

import { useId } from "react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ConfirmReasonFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Giới hạn độ dài — chặn ở ô nhập + hiện bộ đếm. Không truyền = không giới hạn. */
  maxLength?: number;
}

/**
 * Ô lý do bắt buộc của `ConfirmDialog` — textarea vì lý do có thể dài nhiều dòng.
 * Enter = xuống dòng; Ctrl/⌘ + Enter = xác nhận (gửi form bao ngoài).
 */
export function ConfirmReasonField({ label, value, onChange, maxLength }: ConfirmReasonFieldProps) {
  // id riêng mỗi instance — hai dialog cùng mount không trùng id (label/aria-describedby)
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId} className="text-ink-secondary text-xs font-medium">
        {label} <span className="text-danger">*</span>
      </Label>
      <Textarea
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="Nhập lý do…"
        maxLength={maxLength}
        rows={3}
        aria-describedby={hintId}
        autoFocus
        className="border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary focus:border-accent max-h-40 min-h-20 resize-none rounded-[var(--r-sm)]"
      />
      <div
        id={hintId}
        className="text-ink-tertiary flex items-center justify-between text-xs tabular-nums"
      >
        <span>Ctrl/⌘ + Enter để xác nhận</span>
        {maxLength !== undefined && (
          <span>
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
