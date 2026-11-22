"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { ComponentProps } from "react";

const MONO = "font-[family-name:var(--font-mono)] tabular-nums";

/**
 * Một ô quét của màn cất hàng: nhãn + ô nhập mono + gợi ý / lỗi ngay dưới (ô trỏ `aria-describedby` tới dòng đang
 * hiện). Ô tự bôi đen khi focus để lần quét sau ghi đè mã cũ — máy quét không xoá giúp.
 */
export function PutawayScanField({
  id,
  label,
  hint,
  error,
  ...input
}: Omit<ComponentProps<typeof Input>, "id"> & {
  id: string;
  label: string;
  hint: string;
  error?: string;
}) {
  const messageId = error ? `${id}-error` : `${id}-hint`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-ink-primary text-[0.8125rem] font-medium">
        {label}
      </Label>
      <Input
        id={id}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId}
        className={`bg-bg-surface h-9 rounded-[var(--r-sm)] text-[0.8125rem] ${MONO}`}
        onFocus={(event) => event.currentTarget.select()}
        {...input}
      />
      {error ? (
        <p id={messageId} role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : (
        <p id={messageId} className="text-ink-tertiary text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}
