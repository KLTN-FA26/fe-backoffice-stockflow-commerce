"use client";

import { Controller, useWatch } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { CONTRACT_MILESTONE_LABELS, CONTRACT_MILESTONES } from "@/constants";
import { FORM_INPUT_CLASS, fieldA11y } from "@/components/shared/FormField";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DEFAULT_ON_SIGNING_DUE_DAYS } from "../../sales-contract-form";
import { dueRuleText } from "../../sales-contract-rules";

import { AmountModeToggle } from "./AmountModeToggle";

import type { UseFormReturn } from "react-hook-form";
import type { ContractFormValues } from "../../sales-contract-form";

const SELECT = `${FORM_INPUT_CLASS} w-full border px-2`;
const NUM = `${FORM_INPUT_CLASS} text-right font-[family-name:var(--font-mono)] tabular-nums`;

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={`${id}-error`} className="text-danger mt-1 text-xs">
      {message}
    </p>
  ) : null;
}

/**
 * Một đợt thanh toán là một thẻ hai dòng (BO-UX-26, S06-2): tên + mốc + xoá; giá trị (nút ₫ | % cạnh ô) + số ngày sau
 * mốc + đợt giao gắn kèm; dưới thẻ là quy tắc ra hạn ("Hạn = ngày ký + 3 ngày"). Lỗi gắn vào ô qua `fieldA11y`.
 */
export function PaymentPlanRow({
  form,
  index,
  batchCount,
  canRemove,
  onRemove,
}: {
  form: UseFormReturn<ContractFormValues>;
  index: number;
  batchCount: number;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const { register, formState, control, getValues, setValue } = form;
  const e = formState.errors.paymentPlan?.[index];
  const [milestone, mode, dueDays, batchSeq] = useWatch({
    control,
    name: [
      `paymentPlan.${index}.milestone`,
      `paymentPlan.${index}.mode`,
      `paymentPlan.${index}.dueDays`,
      `paymentPlan.${index}.deliveryBatchSeq`,
    ],
  });
  const id = (field: string) => `plan-${index}-${field}`;
  const n = index + 1;
  const valueError = e?.value?.message ?? e?.message;
  const LABEL = "text-ink-secondary mb-1 block text-xs font-medium";
  return (
    <li className="border-border-default space-y-2 rounded-[var(--r-sm)] border p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={id("name")} className={LABEL}>
            Tên đợt
          </label>
          <Input
            {...register(`paymentPlan.${index}.name`)}
            {...fieldA11y(id("name"), e?.name?.message)}
            aria-label={`Đợt ${n} — tên`}
            placeholder="Tên đợt"
            className={FORM_INPUT_CLASS}
          />
          <FieldError id={id("name")} message={e?.name?.message} />
        </div>
        <div className="w-36 shrink-0">
          <label htmlFor={id("milestone")} className={LABEL}>
            Mốc
          </label>
          <select
            id={id("milestone")}
            {...register(`paymentPlan.${index}.milestone`, {
              // N10: an ON_SIGNING row left without a number of days defaults to the BE's 3 days. Moving
              // away from ON_SIGNING drops that untouched default so AFTER_DELIVERY falls back to the credit term.
              onChange: (event: { target: { value: string } }) => {
                const path = `paymentPlan.${index}.dueDays` as const;
                const current = getValues(path);
                if (event.target.value === "ON_SIGNING" && !current)
                  setValue(path, String(DEFAULT_ON_SIGNING_DUE_DAYS));
                else if (
                  event.target.value !== "ON_SIGNING" &&
                  current === String(DEFAULT_ON_SIGNING_DUE_DAYS)
                )
                  setValue(path, "");
              },
            })}
            aria-label={`Đợt ${n} — mốc`}
            className={SELECT}
          >
            {CONTRACT_MILESTONES.map((value) => (
              <option key={value} value={value}>
                {CONTRACT_MILESTONE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-5 shrink-0"
          aria-label={`Xoá đợt thanh toán ${n}`}
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,0.7fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <label htmlFor={id("value")} className={LABEL}>
            Giá trị
          </label>
          <div className="flex items-start gap-2">
            <AmountModeToggle
              label={`Đợt ${n} — tính theo`}
              value={mode}
              onChange={(next) =>
                setValue(`paymentPlan.${index}.mode`, next, { shouldDirty: true })
              }
            />
            <div className="min-w-0 flex-1">
              <Controller
                control={control}
                name={`paymentPlan.${index}.value`}
                render={({ field }) =>
                  mode === "percent" ? (
                    <div className="relative">
                      <Input
                        name={field.name}
                        ref={field.ref}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        {...fieldA11y(id("value"), valueError)}
                        aria-label={`Đợt ${n} — giá trị`}
                        inputMode="decimal"
                        className={`${NUM} pr-7`}
                      />
                      <span
                        aria-hidden="true"
                        className="text-ink-secondary pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs"
                      >
                        %
                      </span>
                    </div>
                  ) : (
                    <MoneyInput
                      name={field.name}
                      ref={field.ref}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      {...fieldA11y(id("value"), valueError)}
                      aria-label={`Đợt ${n} — giá trị`}
                    />
                  )
                }
              />
            </div>
          </div>
          <FieldError id={id("value")} message={valueError} />
        </div>
        <div className="min-w-0">
          <label htmlFor={id("days")} className={LABEL}>
            Hạn (ngày)
          </label>
          <Input
            {...register(`paymentPlan.${index}.dueDays`)}
            {...fieldA11y(id("days"), e?.dueDays?.message, true)}
            aria-label={`Đợt ${n} — số ngày`}
            placeholder={milestone === "ON_SIGNING" ? String(DEFAULT_ON_SIGNING_DUE_DAYS) : "—"}
            disabled={milestone === "BEFORE_DELIVERY"}
            inputMode="numeric"
            className={NUM}
          />
          <FieldError id={id("days")} message={e?.dueDays?.message} />
        </div>
        <div className="min-w-0">
          <label htmlFor={id("batch")} className={LABEL}>
            Gắn đợt giao
          </label>
          <select
            {...register(`paymentPlan.${index}.deliveryBatchSeq`)}
            {...fieldA11y(id("batch"), e?.deliveryBatchSeq?.message)}
            aria-label={`Đợt ${n} — đợt giao`}
            disabled={milestone === "ON_SIGNING"}
            className={SELECT}
          >
            <option value="">—</option>
            {Array.from({ length: batchCount }).map((_, seq) => (
              <option key={seq} value={String(seq + 1)}>
                Đợt giao {seq + 1}
              </option>
            ))}
          </select>
          <FieldError id={id("batch")} message={e?.deliveryBatchSeq?.message} />
        </div>
      </div>
      <p id={`${id("days")}-hint`} className="text-ink-secondary text-xs">
        {dueRuleText({ milestone, dueDays, deliveryBatchSeq: batchSeq })}
      </p>
    </li>
  );
}
