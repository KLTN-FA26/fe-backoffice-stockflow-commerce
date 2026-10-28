"use client";

import { Controller } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { PO_INPUT_CURRENCIES } from "@/features/purchase-order";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";

import { FieldError } from "./CreateFormPrimitives";
import { fieldClass } from "./helpers";

import type { CreatePoWizard } from "./useCreateForm";

const C = UI_LABELS.purchaseOrder.catalog;

/** Ô tiền tệ của PO — shadcn `Select` bọc `Controller`, lỗi inline dưới ô. */
export function CurrencyField({ w }: { w: CreatePoWizard }) {
  const { control, setValue, trigger } = w.form;
  const { errors, values } = w;
  // Tiền tệ NCC chỉ biết qua danh mục (BE quy giá về tiền tệ NCC; `SupplierResponse` không có).
  const catalogCurrency = PO_INPUT_CURRENCIES.find((c) => c === w.catalog.currency);
  const changeCurrency = (next: (typeof PO_INPUT_CURRENCIES)[number]) => {
    setValue("currency", next, { shouldDirty: true });
    // BR-07: giá điền sẵn theo tiền tệ danh mục → xoá / điền lại theo tiền tệ mới.
    const repriced = w.catalog.repriceForCurrency(next);
    // Số lẻ đơn giá phụ thuộc tiền tệ; dòng vừa bị xoá giá phải báo "nhập đơn giá" → kiểm lại.
    if (w.hasPrices || repriced) void trigger("lines");
  };
  return (
    <div>
      <label htmlFor="po-currency" className="text-ink-secondary mb-1 block text-xs font-medium">
        {UI_LABELS.purchaseOrder.currencyOfPo} <span className="text-danger">*</span>
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
              if (next) changeCurrency(next);
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
            <TitledSelectContent title={UI_LABELS.purchaseOrder.currencyOfPo}>
              <SelectGroup>
                {PO_INPUT_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectGroup>
            </TitledSelectContent>
          </Select>
        )}
      />
      <FieldError id="po-currency-error">{errors.currency?.message}</FieldError>
      {/* BR-07 (docs 02 §6): khác tiền tệ danh mục thì không điền sẵn giá — gợi ý đổi cho khớp. */}
      {catalogCurrency && catalogCurrency !== values.currency && (
        <p className="text-ink-secondary mt-1 text-xs">
          {C.currencyHint(catalogCurrency)}{" "}
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0 text-xs"
            onClick={() => changeCurrency(catalogCurrency)}
          >
            {C.applyCurrency(catalogCurrency)}
          </Button>
        </p>
      )}
      {w.hasPrices && (
        <p className="text-warning mt-1 text-xs">
          Đơn giá các dòng đang nhập theo {values.currency} — đổi tiền tệ thì kiểm tra lại đơn giá.
        </p>
      )}
    </div>
  );
}
