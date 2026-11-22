"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "cn";

import { formatCompact } from "@/lib/format/money";
import { Input } from "@/components/ui/input";

import { FORM_INPUT_CLASS } from "./form-control-classes";

import type { ChangeEvent, Ref } from "react";

/** 15 digits stay exact in a JS number (MAX_SAFE_INTEGER has 16). */
const MAX_DIGITS = 15;

/**
 * Digits only, without leading zeros ("0" stays "0" — a free fee). Accepts what people paste: "1.500.000",
 * "1,500,000", "1 500 000 ₫". Anything past the 15th digit is dropped.
 */
export function moneyDigits(text: string): string {
  const digits = text.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits.slice(0, MAX_DIGITS);
}

/** "1500000" → "1.500.000" (vi-VN grouping); "" stays "". */
export function groupMoney(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Caret position in `formatted` just after its `digitCount`-th digit (0 → start). */
function caretAfterDigits(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i] ?? "")) seen += 1;
    if (seen === digitCount) return i + 1;
  }
  return formatted.length;
}

interface MoneyInputProps {
  /** The amount as plain digits ("1500000"), a number, or "" / null when empty. */
  value: string | number | null | undefined;
  /** Plain digits ("" when cleared): what the form keeps and the BE receives. */
  onChange: (digits: string) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  ref?: Ref<HTMLInputElement>;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  /** Visible unit after the number; screen readers get it through the field's label. */
  suffix?: string;
  /** Show the amount in words-ish ("= 1,5 tr ₫") under the field, to catch a zero too many or too few. */
  echo?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/**
 * Ô nhập tiền VND dùng chung (BO-UX-4): nhóm nghìn bằng dấu chấm ngay khi gõ, hậu tố ₫, (tuỳ chọn) dòng nhắc số tiền
 * rút gọn bên dưới. Giá trị ra là chuỗi chữ số thuần — form và BE không thấy dấu chấm. Giữ con trỏ sau đúng chữ số
 * người dùng vừa gõ / xoá khi định dạng lại. Không chứa nghiệp vụ: giới hạn số tiền do form của caller kiểm.
 */
export function MoneyInput({
  value,
  onChange,
  suffix = "₫",
  echo = false,
  className,
  ref,
  id,
  "aria-describedby": describedBy,
  ...props
}: MoneyInputProps) {
  const inner = useRef<HTMLInputElement | null>(null);
  const pendingCaret = useRef<number | null>(null);
  const digits = moneyDigits(value == null ? "" : String(value));
  const formatted = groupMoney(digits);

  useLayoutEffect(() => {
    const el = inner.current;
    if (pendingCaret.current === null || !el || document.activeElement !== el) return;
    const position = caretAfterDigits(formatted, pendingCaret.current);
    pendingCaret.current = null;
    el.setSelectionRange(position, position);
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value: text, selectionStart } = event.target;
    const caret = selectionStart ?? text.length;
    const all = text.replace(/\D/g, "");
    const strippedZeros = all.length - all.replace(/^0+(?=\d)/, "").length;
    const before = text.slice(0, caret).replace(/\D/g, "").length;
    pendingCaret.current = Math.min(MAX_DIGITS, Math.max(0, before - strippedZeros));
    onChange(moneyDigits(text));
  };

  const setRefs = (el: HTMLInputElement | null) => {
    inner.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  const echoId = id ? `${id}-echo` : undefined;
  const showEcho = echo && digits !== "";
  return (
    <div className="min-w-0">
      <div className="relative">
        <Input
          {...props}
          id={id}
          ref={setRefs}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={formatted}
          onChange={handleChange}
          aria-describedby={
            [describedBy, showEcho ? echoId : undefined].filter(Boolean).join(" ") || undefined
          }
          className={cn(
            FORM_INPUT_CLASS,
            "text-right font-[family-name:var(--font-mono)] tabular-nums",
            suffix && "pr-7",
            className,
          )}
        />
        {suffix && (
          <span
            aria-hidden="true"
            className="text-ink-secondary pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs"
          >
            {suffix}
          </span>
        )}
      </div>
      {showEcho && (
        <p id={echoId} className="text-ink-secondary mt-1 text-xs tabular-nums">
          = {formatCompact(Number(digits), "VND")}
        </p>
      )}
    </div>
  );
}
