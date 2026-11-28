"use client";

import { RETURN_RECEIPT_LABELS } from "@/constants/labels-return";
import { Button } from "@/components/ui/button";

const D = RETURN_RECEIPT_LABELS.detail;

/** Nút điền nhanh tình trạng thùng hàng hoàn (Bình thường / Móp / Ướt / Rách); vẫn gõ thêm được ở ô bên trên (S21-2). */
export function CartonConditionButtons({
  value,
  onChange,
}: {
  value: string;
  onChange: (condition: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-0.5" role="group" aria-label={D.conditionQuickLabel}>
      {D.conditionQuick.map((label) => (
        <Button
          key={label}
          type="button"
          size="sm"
          variant={value === label ? "default" : "outline"}
          aria-pressed={value === label}
          onClick={() => onChange(label)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
