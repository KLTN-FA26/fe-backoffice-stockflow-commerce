"use client";

import { RECEIPT_CARTON_LABELS as L } from "@/constants";

import type { ReceiptUnitDto } from "@/features/receipt/types";

/**
 * Chọn đơn vị thùng (SCRUM-473 §3 rule 3) — thường chỉ 1–3 đơn vị đóng gói nên hiện thẳng thành nhóm nút chọn một,
 * không cần mở danh sách. Khoá khi dòng còn thùng có LPN (rule 7: đổi đơn vị phải bỏ hết thùng cũ).
 */
export function CartonUnitPicker({
  lineNo,
  options,
  value,
  disabled,
  onChange,
}: {
  lineNo: number;
  options: readonly ReceiptUnitDto[];
  value: string;
  disabled: boolean;
  onChange: (unit: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={`${L.unit} dòng ${lineNo}`}
      title={disabled ? L.unitLocked : undefined}
      className="flex flex-wrap items-center gap-1.5"
    >
      {options.map((unit) => {
        const checked = unit.unitOfMeasure === value;
        return (
          <button
            key={unit.unitOfMeasure}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(unit.unitOfMeasure)}
            className={`focus-visible:ring-border-strong h-7 rounded-[var(--r-sm)] border px-2.5 font-[family-name:var(--font-mono)] text-xs tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
              checked
                ? "border-brand bg-brand text-ink-inverse"
                : "border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted"
            }`}
          >
            {unit.unitOfMeasure} ({unit.factor})
          </button>
        );
      })}
    </div>
  );
}
