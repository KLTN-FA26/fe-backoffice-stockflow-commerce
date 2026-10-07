"use client";

import { cn } from "cn";

import { currencyFractionDigits } from "@/lib/format";
import { formatMoney } from "@/features/purchase-order";
import { Input } from "@/components/ui/input";

import { FieldError } from "./CreateFormPrimitives";
import { fieldClass, lineTotal } from "./helpers";

import type { CreatePoWizard } from "./useCreateForm";

/** SL đặt / đơn giá / thành tiền của một dòng — lỗi inline dưới từng ô. */
export function PoLineFields({ w, index }: { w: CreatePoWizard; index: number }) {
  const { register } = w.form;
  const currency = w.values.currency;
  const line = w.values.lines[index];
  const errors = w.errors.lines?.[index];
  // BE `Money` làm tròn theo số chữ số thập phân của tiền tệ (VND: số nguyên).
  const priceDigits = currencyFractionDigits(currency);
  const qtyErrorId = `po-line-${index}-qty-error`;
  const priceErrorId = `po-line-${index}-price-error`;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <div>
        <label
          htmlFor={`po-line-${index}-qty`}
          className="text-ink-secondary mb-0.5 block text-[11px] leading-4 font-medium"
        >
          SL đặt <span className="text-danger">*</span>
        </label>
        <Input
          id={`po-line-${index}-qty`}
          {...register(`lines.${index}.orderedQty`)}
          type="number"
          min={1}
          inputMode="numeric"
          aria-invalid={errors?.orderedQty ? true : undefined}
          aria-describedby={errors?.orderedQty ? qtyErrorId : undefined}
          className={cn(fieldClass(!!errors?.orderedQty), "text-right tabular-nums")}
        />
        <FieldError id={qtyErrorId}>{errors?.orderedQty?.message}</FieldError>
      </div>
      <div>
        <label
          htmlFor={`po-line-${index}-price`}
          className="text-ink-secondary mb-0.5 block text-[11px] leading-4 font-medium"
        >
          Đơn giá <span className="text-danger">*</span>
        </label>
        <Input
          id={`po-line-${index}-price`}
          {...register(`lines.${index}.unitPrice`)}
          type="number"
          min={0}
          step={10 ** -priceDigits}
          inputMode={priceDigits === 0 ? "numeric" : "decimal"}
          aria-invalid={errors?.unitPrice ? true : undefined}
          aria-describedby={errors?.unitPrice ? priceErrorId : undefined}
          className={cn(fieldClass(!!errors?.unitPrice), "text-right tabular-nums")}
        />
        <FieldError id={priceErrorId}>{errors?.unitPrice?.message}</FieldError>
      </div>
      <div>
        <label className="text-ink-secondary mb-0.5 block text-[11px] leading-4 font-medium">
          Thành tiền
        </label>
        <Input
          value={formatMoney(line ? lineTotal(line) : 0, currency)}
          readOnly
          aria-label={`Thành tiền dòng ${index + 1}`}
          className={cn(fieldClass(), "bg-bg-muted text-ink-secondary text-right tabular-nums")}
        />
      </div>
    </div>
  );
}
