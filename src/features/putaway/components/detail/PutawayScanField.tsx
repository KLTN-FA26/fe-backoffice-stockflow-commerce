"use client";

import { ScanLine } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { ComponentProps } from "react";

const MONO = "font-[family-name:var(--font-mono)] tabular-nums";

/**
 * Một ô quét của màn cất hàng: nhãn + ô nhập mono + gợi ý / lỗi ngay dưới (ô trỏ `aria-describedby` tới dòng đang
 * hiện). Ô tự bôi đen khi focus để lần quét sau ghi đè mã cũ — máy quét không xoá giúp. Cùng dáng với `ScanInput` của
 * trạm kiểm thùng (R10): cao 48px, chữ mono cỡ thường, biểu tượng quét — gõ tay hay máy quét đều dùng được, không có
 * quét bằng camera. Giữ `register` của react-hook-form vì màn cất cần giữ giá trị ô qua các bước.
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
      <div className="relative">
        <ScanLine className="text-accent pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2" />
        <Input
          id={id}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          className={`border-border-default bg-bg-surface dark:bg-bg-surface focus-visible:border-brand focus-visible:ring-brand/20 h-12 rounded-[var(--r-sm)] pl-11 text-base tracking-wide md:text-base ${MONO}`}
          onFocus={(event) => event.currentTarget.select()}
          {...input}
        />
      </div>
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
