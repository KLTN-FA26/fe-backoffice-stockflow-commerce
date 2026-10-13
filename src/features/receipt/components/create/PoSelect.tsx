"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { ReceivablePo } from "@/features/receipt/types";

const FIELD = "border-border-default bg-bg-surface rounded-[var(--r-sm)] text-[0.8125rem]";

/** Chọn PO chờ nhận (BR-01). `current` = PO mở từ link, có thể không nằm trong trang đầu. */
export function PoSelect({
  value,
  onChange,
  options,
  current,
  errorId,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly ReceivablePo[];
  current: ReceivablePo | undefined;
  /** id của dòng lỗi khi đang lỗi. */
  errorId: string | undefined;
}) {
  const showCurrent =
    current && !options.some((o) => o.purchaseOrderId === current.purchaseOrderId);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        id="receipt-po"
        autoFocus
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId}
        className={`mt-1 w-full max-w-md ${FIELD}`}
      >
        <SelectValue
          placeholder={options.length ? "Chọn đơn đặt hàng" : "Không có đơn nào chờ nhận"}
        />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.purchaseOrderId} value={option.purchaseOrderId}>
            <span className="font-[family-name:var(--font-mono)]">{option.poNumber}</span>
          </SelectItem>
        ))}
        {showCurrent && <SelectItem value={current.purchaseOrderId}>{current.poNumber}</SelectItem>}
      </SelectContent>
    </Select>
  );
}
