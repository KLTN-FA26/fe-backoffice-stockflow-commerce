"use client";

import { Controller, useWatch } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { DesignSnapshotField } from "@/components/backoffice/DesignSnapshotField";
import { Card } from "@/components/shared/Card";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { LinePricePreview } from "./LinePricePreview";
import { TierEditor } from "./TierEditor";

import type { UseFormReturn } from "react-hook-form";
import type { QuoteFormValues } from "@/features/quote/types";

/** Một dòng báo giá: phôi + thiết kế + quy cách in + SL (cái) + giá theo bảng hoặc thoả thuận. */
export function QuoteLineEditor({
  form,
  index,
  customerId,
  blankUnits,
  canRemove,
  onRemove,
}: {
  form: UseFormReturn<QuoteFormValues>;
  index: number;
  customerId: string;
  /** Tổng số cái của cùng mã phôi trên toàn báo giá (P5). */
  blankUnits: number;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const { register, control, formState } = form;
  const errors = formState.errors.lines?.[index];
  const [blankSku, useListPrice] = useWatch({
    control,
    name: [`lines.${index}.blankSku`, `lines.${index}.useListPrice`],
  });
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
          label="Mã phôi (SKU)"
          required
          error={errors?.blankSku?.message}
        >
          <Input
            {...register(`lines.${index}.blankSku`)}
            {...fieldA11y(`${prefix}-sku`, errors?.blankSku?.message)}
            autoCapitalize="characters"
            className={`${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)] uppercase`}
          />
        </FormField>
        <FormField
          id={`${prefix}-qty`}
          label="Số lượng (cái)"
          required
          error={errors?.quantity?.message}
          hint="Chỉ tính theo cái — không quy đổi thùng / carton."
        >
          <Input
            {...register(`lines.${index}.quantity`)}
            {...fieldA11y(`${prefix}-qty`, errors?.quantity?.message, true)}
            inputMode="numeric"
            className={`${FORM_INPUT_CLASS} text-right tabular-nums`}
          />
        </FormField>
        <Controller
          control={control}
          name={`lines.${index}.designSnapshotId`}
          render={({ field }) => (
            <DesignSnapshotField
              id={`${prefix}-design`}
              customerId={customerId}
              value={field.value}
              onChange={field.onChange}
              error={errors?.designSnapshotId?.message}
            />
          )}
        />
        <FormField id={`${prefix}-spec`} label="Quy cách in" error={errors?.printSpec?.message}>
          <Textarea
            {...register(`lines.${index}.printSpec`)}
            {...fieldA11y(`${prefix}-spec`, errors?.printSpec?.message)}
            rows={3}
            className="text-[0.8125rem]"
          />
        </FormField>
      </div>
      <label className="text-ink-primary flex items-center gap-2 text-[0.8125rem]">
        <input
          type="checkbox"
          {...register(`lines.${index}.useListPrice`)}
          className="accent-[var(--brand)]"
        />
        Theo bảng giá của khách (BE tự lấy bậc giá hiện hành)
      </label>
      <LinePricePreview
        customerId={customerId}
        blankSku={(blankSku ?? "").trim().toUpperCase()}
        blankUnits={blankUnits}
        useListPrice={!!useListPrice}
      />
      {!useListPrice && (
        <TierEditor
          lineIndex={index}
          control={control}
          register={register}
          errors={formState.errors.lines}
        />
      )}
    </Card>
  );
}
