"use client";

import { useFieldArray } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { FORM_INPUT_CLASS } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import type { QuoteFormValues } from "@/features/quote/types";

const NUM = `${FORM_INPUT_CLASS} text-right font-[family-name:var(--font-mono)] tabular-nums`;

/** Bậc giá thoả thuận của một dòng (P4: dưới bậc niêm yết thì Sales nhập bậc riêng). */
export function TierEditor({
  lineIndex,
  control,
  register,
  errors,
}: {
  lineIndex: number;
  control: Control<QuoteFormValues>;
  register: UseFormRegister<QuoteFormValues>;
  errors?: FieldErrors<QuoteFormValues>["lines"];
}) {
  const tiers = useFieldArray({ control, name: `lines.${lineIndex}.tiers` });
  const lineErrors = errors?.[lineIndex];
  const listError = lineErrors?.tiers?.root?.message ?? lineErrors?.tiers?.message;

  return (
    <fieldset className="space-y-2">
      <legend className="text-ink-secondary text-xs font-medium">
        Bậc giá thoả thuận (VND / cái)
      </legend>
      {tiers.fields.map((field, tierIndex) => {
        const tierErrors = lineErrors?.tiers?.[tierIndex];
        const minId = `line-${lineIndex}-tier-${tierIndex}-min`;
        const priceId = `line-${lineIndex}-tier-${tierIndex}-price`;
        return (
          <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
            <div>
              <label htmlFor={minId} className="sr-only">
                Từ số lượng (bậc {tierIndex + 1})
              </label>
              <Input
                id={minId}
                {...register(`lines.${lineIndex}.tiers.${tierIndex}.minQuantity`)}
                inputMode="numeric"
                placeholder="Từ SL"
                aria-invalid={tierErrors?.minQuantity ? true : undefined}
                aria-describedby={tierErrors?.minQuantity ? `${minId}-error` : undefined}
                className={NUM}
              />
              {tierErrors?.minQuantity && (
                <p id={`${minId}-error`} className="text-danger mt-1 text-xs">
                  {tierErrors.minQuantity.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor={priceId} className="sr-only">
                Đơn giá (bậc {tierIndex + 1})
              </label>
              <Input
                id={priceId}
                {...register(`lines.${lineIndex}.tiers.${tierIndex}.unitPrice`)}
                inputMode="numeric"
                placeholder="Đơn giá"
                aria-invalid={tierErrors?.unitPrice ? true : undefined}
                aria-describedby={tierErrors?.unitPrice ? `${priceId}-error` : undefined}
                className={NUM}
              />
              {tierErrors?.unitPrice && (
                <p id={`${priceId}-error`} className="text-danger mt-1 text-xs">
                  {tierErrors.unitPrice.message}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Xoá bậc giá ${tierIndex + 1}`}
              onClick={() => tiers.remove(tierIndex)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        );
      })}
      {listError && (
        <p className="text-danger text-xs" role="alert">
          {listError}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={tiers.fields.length >= 20}
        onClick={() => tiers.append({ minQuantity: "", unitPrice: "" })}
      >
        <Plus className="size-3.5" /> Thêm bậc giá
      </Button>
    </fieldset>
  );
}
