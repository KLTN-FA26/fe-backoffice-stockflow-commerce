"use client";

import { useFieldArray } from "react-hook-form";

import { PRODUCTION_LABELS } from "@/constants";

import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { fieldA11y } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";

import type { UseFormReturn } from "react-hook-form";
import type { ProductionOrderEditValues } from "@/features/production-order/types";

const E = PRODUCTION_LABELS.edit;
const C = PRODUCTION_LABELS.detail.lineColumns;

/**
 * Dòng của form sửa nháp (`useFieldArray`): số thùng nguyên ≥ 1 (BR-05) và yêu cầu đóng gói / dán nhãn. Không thêm /
 * bớt dòng — dòng do BE điền theo phần thiếu của đợt giao.
 */
export function EditLineFields({ form }: { form: UseFormReturn<ProductionOrderEditValues> }) {
  const { fields } = useFieldArray({ control: form.control, name: "lines" });
  const errors = form.formState.errors.lines;
  return (
    <table className="w-full text-[0.8125rem]">
      <caption className="sr-only">{PRODUCTION_LABELS.detail.lines}</caption>
      <thead>
        <tr className="text-ink-tertiary text-left text-xs">
          <th scope="col" className="py-1 pr-2 font-medium">
            {C.sku}
          </th>
          <th scope="col" className="w-28 py-1 pr-2 font-medium">
            {E.cartons}
          </th>
          <th scope="col" className="py-1 font-medium">
            {E.packing}
          </th>
        </tr>
      </thead>
      <tbody>
        {fields.map((field, index) => {
          const cartonsError = errors?.[index]?.cartons?.message;
          const packingError = errors?.[index]?.packingRequirements?.message;
          const cartonsId = `edit-line-${index}-cartons`;
          const packingId = `edit-line-${index}-packing`;
          return (
            <tr key={field.id} className="align-top">
              <th
                scope="row"
                className="py-1.5 pr-2 font-[family-name:var(--font-mono)] font-medium"
              >
                {field.sku}
              </th>
              <td className="py-1.5 pr-2">
                <Input
                  {...fieldA11y(cartonsId, cartonsError)}
                  aria-label={`${E.cartons} ${field.sku}`}
                  inputMode="numeric"
                  className={`${FORM_INPUT_CLASS} text-right tabular-nums`}
                  {...form.register(`lines.${index}.cartons`)}
                />
                {cartonsError && (
                  <p id={`${cartonsId}-error`} role="alert" className="text-danger mt-1 text-xs">
                    {cartonsError}
                  </p>
                )}
              </td>
              <td className="py-1.5">
                <Input
                  {...fieldA11y(packingId, packingError)}
                  aria-label={`${E.packing} ${field.sku}`}
                  className={FORM_INPUT_CLASS}
                  {...form.register(`lines.${index}.packingRequirements`)}
                />
                {packingError && (
                  <p id={`${packingId}-error`} role="alert" className="text-danger mt-1 text-xs">
                    {packingError}
                  </p>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
