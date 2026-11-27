"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";
import { X } from "lucide-react";

import { RECEIPT_COUNT_LABELS } from "@/constants";
import { countRowTotal } from "@/features/receipt/count-schemas";
import { countResult } from "@/features/receipt/count-selectors";
import { FormSelect } from "@/components/shared/FormSelect";
import { FORM_INPUT_CLASS, FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { FieldError, NUM } from "../primitives";
import { CountResultCell } from "./CountResultCell";

import type { AreaOption } from "@/lib/references/warehouse-layout";
import type { ReceiptCountFormValues } from "@/features/receipt/types";

const C = RECEIPT_COUNT_LABELS.count;
const MONO = "font-[family-name:var(--font-mono)]";

/**
 * Một dòng Đơn sản xuất trong form kiểm đếm: khu nhận, thùng đã dán nhãn (bấm để bỏ → Void khi lưu), số thùng mới, và
 * đối chiếu đủ / thiếu / thừa theo số thùng luỹ kế (docs 03 §4.1 bước 2–3).
 */
export function CountLineRow({
  index,
  areas,
  lot,
}: {
  index: number;
  areas: readonly AreaOption[];
  lot: string;
}) {
  const { control, register, formState } = useFormContext<ReceiptCountFormValues>();
  const row = useWatch({ control, name: `rows.${index}` });
  const errors = formState.errors.rows?.[index];
  const locationError = errors?.locationCode?.message;
  const cartonsError = errors?.newCartons?.message;
  const ids = { location: `count-${index}-location`, cartons: `count-${index}-cartons` };
  const total = countRowTotal(row);
  const result = countResult(row);

  return (
    <tr className="border-t border-(--table-line) align-top">
      {/* SKU / lô không bẻ dòng: cột SKU đủ rộng, bảng cuộn ngang (có bóng mép) thay vì ép mã xuống 3 dòng */}
      <th scope="row" className="px-3 py-2 text-left font-normal whitespace-nowrap">
        <div className={`text-ink-primary ${MONO}`}>{row.sku}</div>
        <div className="text-ink-tertiary text-xs">{C.lot(lot)}</div>
      </th>
      <td className={`px-3 py-2 whitespace-nowrap ${NUM}`}>
        <div className="text-ink-primary">
          {C.receivedOfOrdered(row.receivedCartons, row.orderedCartons)}
        </div>
        <div className="text-ink-tertiary text-xs">{C.openCartons(row.maxCartons)}</div>
        <div className="text-ink-tertiary text-xs">{C.perCarton(row.unitsPerCarton)}</div>
      </td>
      <td className="w-44 px-3 py-2">
        <Controller
          control={control}
          name={`rows.${index}.locationCode`}
          render={({ field }) => (
            <FormSelect value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id={ids.location}
                aria-label={C.locationAria(row.sku)}
                aria-invalid={!!locationError}
                aria-describedby={locationError ? `${ids.location}-error` : undefined}
                className={FORM_SELECT_CLASS}
              >
                <SelectValue placeholder={C.locationPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {areas.map((area) => (
                  <SelectItem key={area.locationCode} value={area.locationCode}>
                    {area.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </FormSelect>
          )}
        />
        <FieldError id={`${ids.location}-error`}>{locationError}</FieldError>
      </td>
      <td className="px-3 py-2">
        {row.existing.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {row.existing.map((carton, j) => (
              <Controller
                key={carton.lpn}
                control={control}
                name={`rows.${index}.existing.${j}.keep`}
                render={({ field }) => (
                  <button
                    type="button"
                    aria-pressed={field.value}
                    aria-label={
                      field.value ? C.removeCarton(carton.lpn) : C.restoreCarton(carton.lpn)
                    }
                    onClick={() => field.onChange(!field.value)}
                    className={`border-border-default inline-flex items-center gap-1 rounded-[var(--r-sm)] border px-1.5 py-0.5 text-xs ${MONO} focus-visible:ring-brand/30 focus-visible:ring-2 focus-visible:outline-none ${
                      field.value
                        ? "bg-bg-surface text-ink-primary"
                        : "bg-bg-muted text-ink-tertiary line-through"
                    }`}
                  >
                    {carton.lpn}
                    <X aria-hidden className="size-3" />
                  </button>
                )}
              />
            ))}
          </div>
        )}
        <label htmlFor={ids.cartons} className="text-ink-secondary mb-1 block text-xs">
          {C.newCartons}
          {row.existing.length > 0 && (
            <span className="text-ink-tertiary block">
              {C.existingCartons(row.existing.length)}
            </span>
          )}
        </label>
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          aria-label={C.newCartonsAria(row.sku)}
          aria-invalid={!!cartonsError}
          aria-describedby={cartonsError ? `${ids.cartons}-error` : undefined}
          className={`${FORM_INPUT_CLASS} w-24 ${NUM}`}
          id={ids.cartons}
          {...register(`rows.${index}.newCartons`, { valueAsNumber: true })}
        />
        <FieldError id={`${ids.cartons}-error`}>{cartonsError}</FieldError>
      </td>
      <CountResultCell row={row} total={total} result={result} />
    </tr>
  );
}
