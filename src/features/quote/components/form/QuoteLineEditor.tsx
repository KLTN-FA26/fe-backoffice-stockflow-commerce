"use client";

import { useEffect, useRef } from "react";
import { Controller, useWatch } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { moqOf, tierPrice } from "@/features/quote/selectors";
import { Card } from "@/components/shared/Card";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { LinePreview, SuggestionBar } from "./LinePriceHints";
import { QuoteSkuField } from "./QuoteSkuField";
import { TierEditor } from "./TierEditor";
import { useLinePriceSuggestion } from "./useLinePriceSuggestion";

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
  const { register, control, formState, setValue, trigger } = form;
  const errors = formState.errors.lines?.[index];
  const [sku, cartonsText, tierValues] = useWatch({
    control,
    name: [`lines.${index}.sku`, `lines.${index}.cartons`, `lines.${index}.tiers`],
  });
  const allLines = useWatch({ control, name: "lines" });
  const takenElsewhere = new Set(
    (allLines ?? []).filter((_, other) => other !== index).map((line) => line.sku),
  );
  // R6: khách chỉ có một SKU báo giá được → chọn sẵn, không bắt chọn (Sale chỉ thấy chữ).
  const onlySku = skus.length === 1 ? (skus[0]?.sku ?? "") : "";
  useEffect(() => {
    if (onlySku && !sku) setValue(`lines.${index}.sku`, onlySku);
  }, [onlySku, sku, index, setValue]);
  // Giá riêng của khách, không có thì giá chuẩn của quy cách (13 BR-04 / BR-05 sửa ngày 2026-11-26)
  const price = useLinePriceSuggestion(customerId, sku, skus);
  const suggestion = price.suggestion;

  // Read during render so the form subscribes to it.
  const submitted = formState.isSubmitted;
  /** The reference price this line last saw; `undefined` before its first run (a line just added). */
  const seen = useRef<typeof suggestion | undefined>(undefined);
  // 13 BR-05 / BR-04: có giá riêng của khách hoặc giá chuẩn thì được để trống bậc giá (BE tự lấy). Sau lần gửi đầu, khi
  // giá gợi ý của dòng đổi (về sau khi chọn SKU), kiểm lại ô bậc giá ngay (lỗi dưới MOQ nằm ở `tiers`), không đợi lần gửi
  // sau. Một dòng vừa thêm không bị kiểm khi mới hiện: nó chưa có gì để sai.
  useEffect(() => {
    const changed = seen.current !== undefined && seen.current !== suggestion;
    seen.current = suggestion;
    setValue(`lines.${index}.hasCustomerPrice`, !!suggestion);
    setValue(`lines.${index}.customerPriceMoq`, suggestion ? moqOf(suggestion.tiers) : null);
    if (submitted && changed) void trigger(`lines.${index}.tiers`);
  }, [index, setValue, trigger, suggestion, submitted]);

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
        <Controller
          control={control}
          name={`lines.${index}.sku`}
          render={({ field }) => (
            <QuoteSkuField
              id={`${prefix}-sku`}
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              // BE: mỗi SKU chỉ một dòng — dòng này chỉ thấy SKU chưa dùng ở dòng khác (và SKU của chính nó).
              options={skus.filter(
                (option) => option.sku === field.value || !takenElsewhere.has(option.sku),
              )}
              onlyOption={skus.length === 1 ? (skus[0] ?? null) : null}
              error={errors?.sku?.message}
            />
          )}
        />
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
        cartons={cartons}
        suggestion={suggestion}
        loading={price.loading}
        failed={price.failed}
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
