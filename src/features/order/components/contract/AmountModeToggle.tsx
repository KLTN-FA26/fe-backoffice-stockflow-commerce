"use client";

import { ORDER_CONTRACT_LABELS } from "@/constants/labels-order-contract";
import { Button } from "@/components/ui/button";

import type { ContractFormValues } from "../../sales-contract-form";

type AmountMode = ContractFormValues["paymentPlan"][number]["mode"];

const OPTIONS: readonly { value: AmountMode; label: string; name: string }[] = [
  { value: "amount", label: "₫", name: ORDER_CONTRACT_LABELS.plan.amountMode.amount },
  { value: "percent", label: "%", name: ORDER_CONTRACT_LABELS.plan.amountMode.percent },
];

/**
 * Nút phân đoạn "₫ | %" cạnh ô giá trị của một đợt thanh toán (R2: hai giá trị cố định = nút hiện sẵn, không phải ô chọn
 * nhỏ). Một nhóm nút chọn một (`radiogroup`, một điểm dừng Tab, ←/→/↑/↓ đổi lựa chọn); mỗi nút đọc là "Số tiền (₫)" /
 * "% tổng đơn". Cục bộ: `SegmentedControl` dùng chung nằm ở fe#308, chưa merge.
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
    <div
      role="radiogroup"
      aria-label={label}
      className="flex shrink-0"
      // WAI-ARIA radiogroup: one Tab stop (the checked one), arrows move the choice and the focus with it.
      onKeyDown={(event) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const at = OPTIONS.findIndex((option) => option.value === value);
        const next = OPTIONS[(at + step + OPTIONS.length) % OPTIONS.length];
        if (!next) return;
        onChange(next.value);
        event.currentTarget
          .querySelectorAll<HTMLElement>('[role="radio"]')
          [OPTIONS.indexOf(next)]?.focus();
      }}
    >
      {OPTIONS.map((option, index) => (
        <Button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
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
