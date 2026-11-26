"use client";

import { cn } from "cn";

import { Input } from "@/components/ui/input";

import type { ComponentProps } from "react";

type NumberInputProps = Omit<ComponentProps<typeof Input>, "type"> & {
  /** Đơn vị hiện cuối ô (thùng, %, ngày…) — chỉ để đọc, không nằm trong giá trị. */
  suffix?: string;
};

/**
 * Ô nhập số dùng chung (số lượng, %, ngày): không có mũi tên tăng giảm và cuộn chuột trên ô đang focus không đổi số
 * — người lớn tuổi hay lỡ tay cuộn trang rồi thấy số đổi. Vẫn là `<input type="number">` nên bàn phím số trên điện
 * thoại, `min` / `max` / `step` và `valueAsNumber` của react-hook-form giữ nguyên. Tiền thì dùng `MoneyInput`.
 */
export function NumberInput({ suffix, className, onWheel, ...props }: NumberInputProps) {
  const input = (
    <Input
      {...props}
      type="number"
      onWheel={(event) => {
        event.currentTarget.blur();
        onWheel?.(event);
      }}
      className={cn(
        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        suffix && "pr-9",
        className,
      )}
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
