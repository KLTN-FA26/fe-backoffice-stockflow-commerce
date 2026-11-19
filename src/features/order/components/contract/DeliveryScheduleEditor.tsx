"use client";

import { useFieldArray, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { FORM_INPUT_CLASS } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { cartonGaps } from "../../sales-contract-rules";

import type { UseFormReturn } from "react-hook-form";
import type { ContractFormValues } from "../../sales-contract-form";
import type { Order } from "../../types";

const NUM = `${FORM_INPUT_CLASS} w-24 text-right font-[family-name:var(--font-mono)] tabular-nums`;

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-danger mt-1 text-xs">{message}</p> : null;
}

/**
 * Lịch giao nhiều đợt: cửa sổ từ – đến, số thùng từng dòng đơn. F-04.2: hiện ngay "còn thiếu / dư X thùng"
 * theo từng SKU (Σ thùng các đợt = số thùng dòng đơn) — chỉ báo sớm, BE vẫn kiểm (DELIVERY_SCHEDULE_INVALID).
 */
export function DeliveryScheduleEditor({
  form,
  lines,
}: {
  form: UseFormReturn<ContractFormValues>;
  lines: readonly Order["lines"][number][];
}) {
  const { control, register, formState } = form;
  const batches = useFieldArray({ control, name: "deliverySchedule" });
  const schedule = useWatch({ control, name: "deliverySchedule" }) ?? [];
  const gaps = cartonGaps(lines, schedule);
  const errors = formState.errors.deliverySchedule;
  const listError = errors?.root?.message ?? errors?.message;

  return (
    <fieldset className="space-y-3">
      <legend className="text-ink-primary text-sm font-semibold">Lịch giao</legend>
      {listError && (
        <p role="alert" className="text-danger text-xs">
          {listError}
        </p>
      )}
      {batches.fields.map((field, i) => {
        const batchErrors = errors?.[i];
        return (
          <div
            key={field.id}
            className="border-border-default space-y-2 rounded-[var(--r-sm)] border p-3"
          >
            <div className="flex flex-wrap items-end gap-2">
              <span className="text-ink-secondary text-xs font-medium">Đợt {i + 1}</span>
              <label className="text-ink-secondary text-xs">
                Từ ngày
                <Input
                  type="date"
                  {...register(`deliverySchedule.${i}.windowStart`)}
                  aria-label={`Đợt ${i + 1} từ ngày`}
                  className={FORM_INPUT_CLASS}
                />
                <FieldError message={batchErrors?.windowStart?.message} />
              </label>
              <label className="text-ink-secondary text-xs">
                Đến ngày
                <Input
                  type="date"
                  {...register(`deliverySchedule.${i}.windowEnd`)}
                  aria-label={`Đợt ${i + 1} đến ngày`}
                  className={FORM_INPUT_CLASS}
                />
                <FieldError message={batchErrors?.windowEnd?.message} />
              </label>
              {batches.fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Xoá đợt giao ${i + 1}`}
                  onClick={() => batches.remove(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
            {lines.map((line, j) => (
              <label
                key={line.lineId}
                className="text-ink-secondary flex items-center gap-2 text-[0.8125rem]"
              >
                <span className="w-56 truncate font-[family-name:var(--font-mono)]">
                  {line.sku}
                </span>
                <Input
                  {...register(`deliverySchedule.${i}.lines.${j}.cartons`)}
                  aria-label={`Đợt ${i + 1} — ${line.sku} (thùng)`}
                  inputMode="numeric"
                  className={NUM}
                />
                thùng
                <FieldError message={batchErrors?.lines?.[j]?.cartons?.message} />
              </label>
            ))}
            <FieldError
              message={batchErrors?.lines?.message ?? batchErrors?.lines?.root?.message}
            />
          </div>
        );
      })}
      <ul aria-label="Đối chiếu số thùng" className="space-y-0.5 text-[0.8125rem]">
        {gaps.map((gap) => (
          <li
            key={gap.orderLineId}
            className={gap.diff === 0 ? "text-ink-secondary" : "text-danger"}
          >
            <span className="font-[family-name:var(--font-mono)]">{gap.sku}</span>: {gap.scheduled}{" "}
            / {gap.ordered} thùng
            {gap.diff < 0 && ` — còn thiếu ${-gap.diff} thùng`}
            {gap.diff > 0 && ` — dư ${gap.diff} thùng`}
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={batches.fields.length >= 20}
        onClick={() =>
          batches.append({
            windowStart: "",
            windowEnd: "",
            lines: lines.map((line) => ({ orderLineId: line.lineId, cartons: "0" })),
          })
        }
      >
        <Plus className="size-3.5" /> Thêm đợt giao
      </Button>
    </fieldset>
  );
}
