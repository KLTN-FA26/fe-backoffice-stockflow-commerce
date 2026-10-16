"use client";

import { Controller } from "react-hook-form";

import { PO_INPUT_CURRENCIES } from "@/features/purchase-order";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FieldError } from "./CreateFormPrimitives";
import { fieldClass } from "./helpers";

import type { CreatePoWizard } from "./useCreateForm";

/** Ô tiền tệ của PO — shadcn `Select` bọc `Controller`, lỗi inline dưới ô. */
export function CurrencyField({ w }: { w: CreatePoWizard }) {
  const { control, trigger } = w.form;
  const { errors, values } = w;
  return (
    <div>
      <label htmlFor="po-currency" className="text-ink-secondary mb-1 block text-xs font-medium">
        Tiền tệ của PO <span className="text-danger">*</span>
      </label>
      {/* BR-07 (docs 02 §6): một PO một loại tiền; NCC không mang tiền tệ (BE #36). */}
      <Controller
        control={control}
        name="currency"
        render={({ field }) => (
          <Select
            value={field.value}
            onValueChange={(v) => {
              const next = PO_INPUT_CURRENCIES.find((c) => c === v);
              if (!next) return;
              field.onChange(next);
              // Số lẻ đơn giá phụ thuộc tiền tệ → kiểm lại các dòng đã nhập giá.
              if (w.hasPrices) void trigger("lines");
            }}
          >
            <SelectTrigger
              id="po-currency"
              aria-invalid={errors.currency ? true : undefined}
              aria-describedby={errors.currency ? "po-currency-error" : undefined}
              className={fieldClass(!!errors.currency)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PO_INPUT_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      />
      <FieldError id="po-currency-error">{errors.currency?.message}</FieldError>
      {w.hasPrices && (
        <p className="text-warning mt-1 text-xs">
          Đơn giá các dòng đang nhập theo {values.currency} — đổi tiền tệ thì kiểm tra lại đơn giá.
        </p>
      )}
    </div>
  );
}
