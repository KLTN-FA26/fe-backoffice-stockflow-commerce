"use client";

import { BANK_TRANSACTION_LABELS } from "@/constants/bank-transaction";
import { HeaderFilterPopover } from "@/components/shared/ColumnHeaderFilter";
import { MoneyInput } from "@/components/shared/MoneyInput";

const L = BANK_TRANSACTION_LABELS;

/**
 * Lọc giao dịch đúng một số tiền (bo-25, BE `GET /bank-transactions?amount=`, PR #497) — Kế toán tra một khoản khách báo
 * đã chuyển. Giá trị là chuỗi chữ số (rỗng = không lọc); trang lưu trên URL và gửi BE.
 */
export function AmountHeaderFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (digits: string) => void;
}) {
  return (
    <HeaderFilterPopover label={L.amountFilterLabel} active={!!value} onClear={() => onChange("")}>
      <label className="grid gap-1 px-1 pt-1">
        <span className="text-ink-tertiary text-xs">{L.amountFilterField}</span>
        <MoneyInput
          value={value}
          onChange={onChange}
          aria-label={L.amountFilterField}
          autoFocus
          className="h-8 text-[0.8125rem]"
        />
      </label>
    </HeaderFilterPopover>
  );
}
