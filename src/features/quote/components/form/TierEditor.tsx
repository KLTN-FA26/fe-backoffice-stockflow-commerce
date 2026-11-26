"use client";

import { Controller, useFieldArray } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { FORM_INPUT_CLASS } from "@/components/shared/FormField";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import type { QuoteFormValues } from "@/features/quote/types";

const NUM = `${FORM_INPUT_CLASS} text-right font-[family-name:var(--font-mono)] tabular-nums`;
const TH = "text-ink-secondary px-1 pb-1 text-left text-xs font-medium";

/**
 * Bậc giá của một dòng: từ N thùng trở lên → đơn giá VND / cái; bậc thấp nhất là MOQ (14 BR-08). Bảng có tiêu đề cột
 * hiện rõ (BO-UX-14) — điền xong vẫn biết ô nào là số thùng, ô nào là đơn giá; đơn giá nhập qua `MoneyInput` (BO-UX-4).
 */
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
  const captionId = `line-${lineIndex}-tiers-caption`;

  return (
    <div className="space-y-2">
      <p id={captionId} className="text-ink-secondary text-xs font-medium">
        Bậc giá
      </p>
      {tiers.fields.length > 0 && (
        <table
          aria-labelledby={captionId}
          className="w-full max-w-xl border-separate border-spacing-y-1"
        >
          <thead>
            <tr>
              <th scope="col" className={TH}>
                Từ số thùng
              </th>
              <th scope="col" className={TH}>
                Đơn giá một cái
              </th>
              <th scope="col" className="w-9">
                <span className="sr-only">Xoá</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {tiers.fields.map((field, tierIndex) => {
              const tierErrors = lineErrors?.tiers?.[tierIndex];
              const minId = `line-${lineIndex}-tier-${tierIndex}-min`;
              const priceId = `line-${lineIndex}-tier-${tierIndex}-price`;
              const minError = tierErrors?.minQuantity?.message;
              const priceError = tierErrors?.unitPrice?.message;
              return (
                <tr key={field.id} className="align-top">
                  <td className="pr-2">
                    <label htmlFor={minId} className="sr-only">
                      Từ số thùng (bậc {tierIndex + 1})
                    </label>
                    <div className="relative">
                      <Input
                        id={minId}
                        {...register(`lines.${lineIndex}.tiers.${tierIndex}.minQuantity`)}
                        inputMode="numeric"
                        aria-invalid={minError ? true : undefined}
                        aria-describedby={
                          [minError ? `${minId}-error` : "", tierIndex === 0 ? `${minId}-moq` : ""]
                            .filter(Boolean)
                            .join(" ") || undefined
                        }
                        className={`${NUM} pr-14`}
                      />
                      <span
                        aria-hidden="true"
                        className="text-ink-secondary pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs"
                      >
                        thùng
                      </span>
                    </div>
                    {tierIndex === 0 && (
                      <p id={`${minId}-moq`} className="text-ink-secondary mt-1 text-xs">
                        Bậc đầu là số thùng tối thiểu của báo giá
                      </p>
                    )}
                    {minError && (
                      <p id={`${minId}-error`} className="text-danger mt-1 text-xs">
                        {minError}
                      </p>
                    )}
                  </td>
                  <td className="pr-2">
                    <label htmlFor={priceId} className="sr-only">
                      Đơn giá ₫ một cái (bậc {tierIndex + 1})
                    </label>
                    <Controller
                      control={control}
                      name={`lines.${lineIndex}.tiers.${tierIndex}.unitPrice`}
                      render={({ field: price }) => (
                        <MoneyInput
                          id={priceId}
                          name={price.name}
                          ref={price.ref}
                          value={price.value}
                          onChange={price.onChange}
                          onBlur={price.onBlur}
                          aria-invalid={priceError ? true : undefined}
                          aria-describedby={priceError ? `${priceId}-error` : undefined}
                        />
                      )}
                    />
                    {priceError && (
                      <p id={`${priceId}-error`} className="text-danger mt-1 text-xs">
                        {priceError}
                      </p>
                    )}
                  </td>
                  <td>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Xoá bậc giá ${tierIndex + 1}`}
                      onClick={() => tiers.remove(tierIndex)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
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
    </div>
  );
}
