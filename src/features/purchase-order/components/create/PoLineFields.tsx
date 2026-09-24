"use client";

import { cn } from "cn";

import { formatMoney } from "@/features/purchase-order";

import type { Currency } from "@/features/purchase-order";
import { Input } from "@/components/ui/input";

import { fieldClass, lineTotal, parseNonNegativeNumber, parsePositiveNumber } from "./helpers";
import type { PoLineDraft } from "./types";

export function PoLineFields({
  line,
  currency,
  showErrors,
  onUpdate,
}: {
  line: PoLineDraft;
  currency: Currency;
  showErrors: boolean;
  onUpdate: (lineId: string, patch: Partial<PoLineDraft>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div>
        <label className="text-ink-secondary mb-0.5 block text-[11px] leading-4 font-medium">
          SL đặt <span className="text-danger">*</span>
        </label>
        <Input
          value={line.orderedQty}
          onChange={(e) => onUpdate(line.id, { orderedQty: e.target.value })}
          type="number"
          min={1}
          inputMode="numeric"
          className={cn(
            fieldClass(showErrors && !parsePositiveNumber(line.orderedQty)),
            "text-right tabular-nums",
          )}
        />
      </div>
      <div>
        <label className="text-ink-secondary mb-0.5 block text-[11px] leading-4 font-medium">
          Đơn giá <span className="text-danger">*</span>
        </label>
        <Input
          value={line.unitPrice}
          onChange={(e) => onUpdate(line.id, { unitPrice: e.target.value })}
          type="number"
          min={0}
          inputMode="decimal"
          className={cn(
            fieldClass(showErrors && !parseNonNegativeNumber(line.unitPrice)),
            "text-right tabular-nums",
          )}
        />
      </div>
      <div>
        <label className="text-ink-secondary mb-0.5 block text-[11px] leading-4 font-medium">
          UoM
        </label>
        <Input value={line.uom} disabled className={fieldClass()} />
      </div>
      <div>
        <label className="text-ink-secondary mb-0.5 block text-[11px] leading-4 font-medium">
          Thành tiền
        </label>
        <Input
          value={formatMoney(lineTotal(line), currency)}
          readOnly
          className={cn(fieldClass(), "bg-bg-muted text-ink-secondary text-right tabular-nums")}
        />
      </div>
    </div>
  );
}
