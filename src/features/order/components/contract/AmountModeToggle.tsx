"use client";

import { Button } from "@/components/ui/button";

import type { ContractFormValues } from "../../sales-contract-form";

type AmountMode = ContractFormValues["paymentPlan"][number]["mode"];

const OPTIONS: readonly { value: AmountMode; label: string; name: string }[] = [
  { value: "amount", label: "₫", name: "Số tiền (₫)" },
  { value: "percent", label: "%", name: "% tổng đơn" },
];

/**
 * Nút phân đoạn "₫ | %" cạnh ô giá trị của một đợt thanh toán (R2: hai giá trị cố định = nút hiện sẵn, không phải ô chọn
 * nhỏ). Một nhóm nút chọn một (`radiogroup`); mỗi nút đọc là "Số tiền (₫)" / "% tổng đơn".
 */
export function AmountModeToggle({
  value,
  onChange,
  label,
}: {
  value: AmountMode;
  onChange: (mode: AmountMode) => void;
  /** Tên nhóm cho trình đọc màn hình ("Đợt 1 — tính theo"). */
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0">
      {OPTIONS.map((option, index) => (
        <Button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          aria-label={option.name}
          title={option.name}
          variant={value === option.value ? "default" : "outline"}
          className={`h-9 w-10 rounded-none text-[0.8125rem] ${
            index === 0 ? "rounded-l-[var(--r-sm)]" : "-ml-px rounded-r-[var(--r-sm)]"
          }`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
