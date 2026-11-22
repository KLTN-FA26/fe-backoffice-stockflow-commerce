"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "cn";

import { UI_LABELS } from "@/constants";
import { formatCompact } from "@/lib/format/money";
import { Input } from "@/components/ui/input";

import { FORM_INPUT_CLASS } from "./form-control-classes";

import type { ChangeEvent, Ref } from "react";

/** 15 digits stay exact in a JS number (MAX_SAFE_INTEGER has 16). */
const MAX_DIGITS = 15;

/**
 * A decimal part at the end: one or two digits after the last "." or ",", then only a unit or spaces ("…,50",
 * "….00 ₫"). Thousands groups always have three digits, so "1.500.000" and "1,500,000 ₫" never match.
 */
const TRAILING_FRACTION = /^(.*\d)[.,](\d{1,2})[^\d.,]*$/;

/** Digits only, without leading zeros ("0" stays "0" — a free fee), at most 15 of them. */
function onlyDigits(text: string): string {
  return text.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, MAX_DIGITS);
}

/** What a pasted or typed amount says: its whole VND as digits, and whether it carried a decimal part. */
export interface MoneyText {
  digits: string;
  /** `zero`: ".00" / ",00", dropped silently; `nonzero`: VND has no smaller unit, so the amount is refused. */
  fraction: "none" | "zero" | "nonzero";
}

/**
 * Reads an amount in either locale: "1.500.000,00" (vi) and "1,500,000.00" (en) are both 1.500.000 ₫, not
 * 150.000.000 ₫ — stripping every non-digit would have read the decimals as two more digits.
 */
export function parseMoney(text: string): MoneyText {
  const match = TRAILING_FRACTION.exec(text);
  if (!match) return { digits: onlyDigits(text), fraction: "none" };
  const [, whole = "", decimals = ""] = match;
  return { digits: onlyDigits(whole), fraction: /^0+$/.test(decimals) ? "zero" : "nonzero" };
}

/**
 * The whole VND of a text as plain digits. Accepts what people paste: "1.500.000", "1,500,000", "1 500 000 ₫",
 * "1,500,000.00". A decimal part is not read as digits (see `parseMoney`); anything past the 15th digit is dropped.
 */
export function moneyDigits(text: string): string {
  return parseMoney(text).digits;
}

/**
 * Whether `next` is `previous` with one stretch of characters removed. Backspacing "1.500" gives "1.50", which is
 * the digits 150 — not a decimal part — so a deletion is read as plain digits.
 */
function isDeletionOf(previous: string, next: string): boolean {
  if (next.length >= previous.length) return false;
  let start = 0;
  while (start < next.length && next[start] === previous[start]) start += 1;
  return previous.endsWith(next.slice(start));
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
  const [fractionRefused, setFractionRefused] = useState(false);
  const fallbackId = useId();
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
    const native = event.nativeEvent;
    const deleting =
      typeof InputEvent !== "undefined" && native instanceof InputEvent && native.inputType
        ? native.inputType.startsWith("delete")
        : isDeletionOf(formatted, text);
    const parsed: MoneyText = deleting
      ? { digits: onlyDigits(text), fraction: "none" }
      : parseMoney(text);
    if (parsed.fraction === "nonzero") {
      // Keep the amount as it was: guessing "1.500.000,5" as 1.500.000 or 15.000.005 would both be wrong.
      setFractionRefused(true);
      return;
    }
    setFractionRefused(false);
    const caret = selectionStart ?? text.length;
    const all = text.replace(/\D/g, "");
    const strippedZeros = all.length - all.replace(/^0+(?=\d)/, "").length;
    const before = text.slice(0, caret).replace(/\D/g, "").length;
    pendingCaret.current = Math.min(
      parsed.digits.length,
      MAX_DIGITS,
      Math.max(0, before - strippedZeros),
    );
    onChange(parsed.digits);
  };

  const setRefs = (el: HTMLInputElement | null) => {
    inner.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  const echoId = id ? `${id}-echo` : undefined;
  const showEcho = echo && digits !== "";
  const fractionId = `${id ?? fallbackId}-fraction`;
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
          aria-invalid={fractionRefused || props["aria-invalid"] || undefined}
          aria-describedby={
            [describedBy, fractionRefused ? fractionId : undefined, showEcho ? echoId : undefined]
              .filter(Boolean)
              .join(" ") || undefined
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
      {fractionRefused && (
        <p id={fractionId} role="alert" className="text-danger mt-1 text-xs">
          {UI_LABELS.moneyInput.fractionRefused}
        </p>
      )}
      {showEcho && (
        <p id={echoId} className="text-ink-secondary mt-1 text-xs tabular-nums">
          = {formatCompact(Number(digits), "VND")}
        </p>
      )}
    </div>
  );
}
