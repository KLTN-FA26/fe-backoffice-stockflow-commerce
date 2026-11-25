"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray } from "react-hook-form";

import { PRICE_TIER_FORM_LABELS as F, PRICE_TIER_LIMITS } from "@/constants";
import { emptyTier } from "@/lib/pricing/price-tier-form";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { UseFormReturn } from "react-hook-form";
import type { PriceTierFormValues } from "@/lib/pricing/price-tier-form";

const NUMBER_INPUT = `${FORM_INPUT_CLASS} text-right tabular-nums`;
const NOTE = "text-ink-tertiary text-xs";

/**
 * Bậc giá theo thùng dùng chung cho bảng giá riêng của khách và giá chuẩn theo quy cách: 1–20 bậc, nhập theo thứ tự bất
 * kỳ (BE tự sắp), không có ô MOQ riêng (MOQ = số thùng nhỏ nhất). Mỗi ô có lỗi ngay dưới — gồm cả lỗi BE `tiers[i].*`
 * theo đúng dòng. `idPrefix` để hai form trên cùng trang không trùng id.
 */
export function PriceTierEditor({
  form,
  idPrefix,
}: {
  form: UseFormReturn<PriceTierFormValues>;
  idPrefix: string;
}) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "tiers" });
  const errors = form.formState.errors.tiers;
  // Trùng số lượng là luật chéo dòng → đổi một ô số lượng thì kiểm lại mọi dòng
  const revalidate = () => void form.trigger("tiers");

  return (
    <fieldset className="m-0 min-w-0 space-y-2 border-0 p-0">
      <legend className="text-ink-secondary mb-1 text-xs font-medium">{F.tiers}</legend>
      <p className={NOTE}>{F.moqHint}</p>
      <p className={NOTE}>{F.tierOrderHint}</p>
      {typeof errors?.message === "string" && (
        <p className="text-danger text-xs">{errors.message}</p>
      )}
      <ol className="space-y-2">
        {fields.map((field, i) => {
          const rowErrors = errors?.[i];
          const label = F.tierLabel(i + 1);
          return (
            <li
              key={field.id}
              aria-label={label}
              className="grid grid-cols-[1fr_1fr_auto] items-start gap-2"
            >
              <div className="space-y-1">
                <Label htmlFor={`${idPrefix}-tier-${i}-qty`} className="text-ink-secondary text-xs">
                  {`${label} — ${F.minQuantity}`}
                </Label>
                <Input
                  id={`${idPrefix}-tier-${i}-qty`}
                  inputMode="numeric"
                  {...form.register(`tiers.${i}.minQuantity`, { onChange: revalidate })}
                  className={NUMBER_INPUT}
                />
                {rowErrors?.minQuantity && (
                  <p className="text-danger text-xs">{rowErrors.minQuantity.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor={`${idPrefix}-tier-${i}-price`}
                  className="text-ink-secondary text-xs"
                >
                  {`${label} — ${F.unitPrice}`}
                </Label>
                <Input
                  id={`${idPrefix}-tier-${i}-price`}
                  inputMode="numeric"
                  {...form.register(`tiers.${i}.unitPrice`)}
                  className={NUMBER_INPUT}
                />
                {rowErrors?.unitPrice && (
                  <p className="text-danger text-xs">{rowErrors.unitPrice.message}</p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-5"
                aria-label={F.removeTier(i + 1)}
                // Luôn còn ít nhất một bậc (BE `@NotEmpty`)
                disabled={fields.length <= 1}
                onClick={() => {
                  remove(i);
                  revalidate();
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          );
        })}
      </ol>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={fields.length >= PRICE_TIER_LIMITS.tiersMax}
          onClick={() => append(emptyTier())}
        >
          <Plus className="size-3.5" /> {F.addTier}
        </Button>
        {fields.length >= PRICE_TIER_LIMITS.tiersMax && <span className={NOTE}>{F.tierLimit}</span>}
      </div>
    </fieldset>
  );
}
