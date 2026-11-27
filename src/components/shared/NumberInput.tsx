"use client";

import { cn } from "cn";

import { Input } from "@/components/ui/input";

import type { ChangeEvent, ComponentProps, KeyboardEvent } from "react";

type NumberInputProps = Omit<ComponentProps<typeof Input>, "type" | "value" | "inputMode"> & {
  /** Đơn vị hiện cuối ô (thùng, %, ngày…) — chỉ để đọc, không nằm trong giá trị. */
  suffix?: string;
  /** Cho một dấu thập phân (`.` hoặc `,`, đổi thành `.`); mặc định chỉ nhận số nguyên. */
  decimal?: boolean;
  /**
   * Chỉ cho ô do nơi dùng giữ giá trị (`value` là chuỗi chữ số, `onChange` nhận chuỗi chữ số): hiện nhóm nghìn bằng dấu
   * chấm như `MoneyInput`, giá trị ra vẫn là chữ số thuần. Ô đăng ký bằng react-hook-form không nhóm được.
   */
  grouped?: boolean;
  value?: string | number;
};

/** "1234567" → "1.234.567" (phần thập phân, nếu có, giữ nguyên). */
export function groupDigits(text: string): string {
  const [whole = "", fraction] = text.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
}

function clean(raw: string, decimal: boolean): string {
  if (!decimal) return raw.replace(/\D/g, "");
  const text = raw.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const dot = text.indexOf(".");
  return dot < 0 ? text : `${text.slice(0, dot + 1)}${text.slice(dot + 1).replace(/\./g, "")}`;
}

/**
 * Ô nhập số dùng chung (số lượng, %, ngày): ô chữ với bàn phím số, KHÔNG có mũi tên và ↑ / ↓ hay cuộn chuột không đổi số —
 * người lớn tuổi hay lỡ tay rồi thấy số đổi. Chỉ giữ chữ số (và một dấu thập phân khi `decimal`) ngay khi gõ / dán, nên giá
 * trị form và BE vẫn là chuỗi số thuần như `<input type="number">`; `valueAsNumber` của react-hook-form vẫn dùng được. Tiền
 * thì dùng `MoneyInput`.
 */
export function NumberInput({
  suffix,
  decimal = false,
  grouped = false,
  value,
  className,
  onChange,
  onKeyDown,
  ...props
}: NumberInputProps) {
  const shown =
    value === undefined ? undefined : grouped ? groupDigits(String(value)) : String(value);
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.target.value = clean(event.target.value, decimal);
    onChange?.(event);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") event.preventDefault();
    onKeyDown?.(event);
  };
  const input = (
    <Input
      autoComplete="off"
      {...props}
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      value={shown}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={cn(suffix && "pr-9", className)}
    />
  );
  if (!suffix) return input;
  return (
    <div className="relative inline-block max-w-full">
      {input}
      <span
        aria-hidden
        className="text-ink-tertiary pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs"
      >
        {suffix}
      </span>
    </div>
  );
}
