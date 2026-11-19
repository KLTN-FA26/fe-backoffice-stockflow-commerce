"use client";

import { useEffect } from "react";
import { Controller, useWatch } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { useCustomerPrice } from "@/features/quote/queries";
import { moqOf, tierPrice } from "@/features/quote/selectors";
import { Card } from "@/components/shared/Card";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { LinePreview, SuggestionBar } from "./LinePriceHints";
import { TierEditor } from "./TierEditor";

import type { UseFormReturn } from "react-hook-form";
import type { CustomerSku, QuoteFormValues, QuoteTier } from "@/features/quote/types";

const NUM = "tabular-nums font-[family-name:var(--font-mono)]";

function toTiers(values: QuoteFormValues["lines"][number]["tiers"] | undefined): QuoteTier[] {
  return (values ?? [])
    .map((tier) => ({ minQuantity: Number(tier.minQuantity), unitPrice: Number(tier.unitPrice) }))
    .filter((tier) => tier.minQuantity > 0 && tier.unitPrice > 0);
}

/**
 * Một dòng báo giá: SKU riêng của khách + số thùng + bậc giá (thùng tối thiểu → đơn giá / cái).
 * `unitsPerCarton` chỉ biết sau khi lưu (BE trả trên dòng) — trước đó không quy đổi ra cái.
 */
export function QuoteLineEditor({
  form,
  index,
  customerId,
  skus,
  unitsPerCarton,
  canRemove,
  onRemove,
}: {
  form: UseFormReturn<QuoteFormValues>;
  index: number;
  customerId: string;
  skus: readonly CustomerSku[];
  unitsPerCarton: number | null;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const { register, control, formState, setValue } = form;
  const errors = formState.errors.lines?.[index];
  const [sku, cartonsText, tierValues] = useWatch({
    control,
    name: [`lines.${index}.sku`, `lines.${index}.cartons`, `lines.${index}.tiers`],
  });
  const price = useCustomerPrice(customerId, sku);
  const suggestion = price.data ?? null;

  // 13 BR-05: có giá riêng thì được để trống bậc giá (BE tự lấy).
  useEffect(() => {
    setValue(`lines.${index}.hasCustomerPrice`, !!suggestion);
  }, [index, setValue, suggestion]);

  const tiers = toTiers(tierValues);
  const effective = tiers.length ? tiers : (suggestion?.tiers ?? []);
  const moq = moqOf(effective);
  const cartons = Number(cartonsText);
  const unitPrice = tierPrice(effective, cartons);
  const prefix = `line-${index}`;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-ink-primary text-sm font-semibold">Dòng {index + 1}</h3>
        {canRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="size-3.5" /> Xoá dòng
          </Button>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField
          id={`${prefix}-sku`}
          label="SKU riêng của khách"
          required
          error={errors?.sku?.message}
        >
          {/* Select có kiểm soát: danh sách SKU tải sau form, một <select> chỉ `register` thì hiện trống dù
              giá trị form vẫn là SKU của dòng (WF-02 audit). SKU của dòng chưa có trong danh sách vẫn có option. */}
          <Controller
            control={control}
            name={`lines.${index}.sku`}
            render={({ field }) => (
              <select
                name={field.name}
                ref={field.ref}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                {...fieldA11y(`${prefix}-sku`, errors?.sku?.message)}
                className={`${FORM_INPUT_CLASS} border px-2 font-[family-name:var(--font-mono)]`}
              >
                <option value="">Chọn SKU</option>
                {field.value && !skus.some((option) => option.sku === field.value) && (
                  <option value={field.value}>{field.value}</option>
                )}
                {skus.map((option) => (
                  <option key={option.variantId} value={option.sku}>
                    {option.sku}
                    {option.name ? ` — ${option.name}` : ""}
                  </option>
                ))}
              </select>
            )}
          />
        </FormField>
        <FormField
          id={`${prefix}-cartons`}
          label="Số thùng"
          required
          error={errors?.cartons?.message}
          hint={
            unitsPerCarton && cartons > 0
              ? `= ${(cartons * unitsPerCarton).toLocaleString("vi-VN")} cái (${unitsPerCarton.toLocaleString("vi-VN")} cái/thùng)`
              : "Quy đổi ra cái hiện sau khi lưu nháp."
          }
        >
          <Input
            {...register(`lines.${index}.cartons`)}
            {...fieldA11y(`${prefix}-cartons`, errors?.cartons?.message, true)}
            inputMode="numeric"
            className={`${FORM_INPUT_CLASS} text-right ${NUM}`}
          />
        </FormField>
      </div>
      <SuggestionBar
        sku={sku}
        moq={moq}
        suggestion={suggestion}
        loading={price.isFetching}
        failed={price.isError}
        tiersEmpty={tiers.length === 0}
        onUse={(next) =>
          setValue(`lines.${index}.tiers`, next, { shouldDirty: true, shouldValidate: true })
        }
      />
      <TierEditor
        lineIndex={index}
        control={control}
        register={register}
        errors={formState.errors.lines}
      />
      <LinePreview
        cartons={cartons}
        moq={moq}
        unitPrice={unitPrice}
        unitsPerCarton={unitsPerCarton}
      />
    </Card>
  );
}
