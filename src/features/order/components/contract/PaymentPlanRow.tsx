"use client";

import { Controller, useWatch } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { CONTRACT_MILESTONE_LABELS, CONTRACT_MILESTONES } from "@/constants";
import { ORDER_CONTRACT_LABELS } from "@/constants/labels-order-contract";
import { FORM_INPUT_CLASS, fieldA11y } from "@/components/shared/FormField";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { FormSelect } from "@/components/shared/FormSelect";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { DEFAULT_ON_SIGNING_DUE_DAYS } from "../../sales-contract-form";
import { dueRuleText } from "../../sales-contract-rules";

import { AmountModeToggle } from "./AmountModeToggle";

import type { UseFormReturn } from "react-hook-form";
import type { ContractFormValues } from "../../sales-contract-form";

const P = ORDER_CONTRACT_LABELS.plan;
/** Radix Select has no empty value: stands for "no batch". */
const NO_BATCH = "none";
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
            {P.name}
          </label>
          <Input
            {...register(`paymentPlan.${index}.name`)}
            {...fieldA11y(id("name"), e?.name?.message)}
            aria-label={`Đợt ${n} — tên`}
            placeholder={P.name}
            className={FORM_INPUT_CLASS}
          />
          <FieldError id={id("name")} message={e?.name?.message} />
        </div>
        <div className="w-36 shrink-0">
          <label htmlFor={id("milestone")} className={LABEL}>
            {P.milestone}
          </label>
          <Controller
            control={control}
            name={`paymentPlan.${index}.milestone`}
            render={({ field }) => (
              <FormSelect
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  // N10: an ON_SIGNING row left without a number of days defaults to the BE's 3 days. Moving
                  // away from ON_SIGNING drops that untouched default so AFTER_DELIVERY falls back to the credit term.
                  const path = `paymentPlan.${index}.dueDays` as const;
                  const current = getValues(path);
                  if (value === "ON_SIGNING" && !current)
                    setValue(path, String(DEFAULT_ON_SIGNING_DUE_DAYS));
                  else if (
                    value !== "ON_SIGNING" &&
                    current === String(DEFAULT_ON_SIGNING_DUE_DAYS)
                  )
                    setValue(path, "");
                }}
              >
                <SelectTrigger
                  id={id("milestone")}
                  aria-label={`Đợt ${n} — mốc`}
                  className={FORM_SELECT_CLASS}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_MILESTONES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CONTRACT_MILESTONE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </FormSelect>
            )}
          />
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
            {P.value}
          </label>
          <div className="flex items-start gap-2">
            <AmountModeToggle
              label={`Đợt ${n} — tính theo`}
              value={mode}
              onChange={(next) => {
                if (next === mode) return;
                setValue(`paymentPlan.${index}.mode`, next, { shouldDirty: true });
                // "30,5" as a percent is not "30 ₫": the number means something else now, so it is cleared and
                // asked again (an error shows at once when the form was already submitted).
                setValue(`paymentPlan.${index}.value`, "", {
                  shouldDirty: true,
                  shouldValidate: formState.isSubmitted,
                });
              }}
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
            {P.days}
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
            {P.batch}
          </label>
          <Controller
            control={control}
            name={`paymentPlan.${index}.deliveryBatchSeq`}
            render={({ field }) => (
              <FormSelect
                // Radix has no empty item: "none" stands for "not tied to a batch" (the form keeps "").
                value={field.value || NO_BATCH}
                onValueChange={(value) => field.onChange(value === NO_BATCH ? "" : value)}
                disabled={milestone === "ON_SIGNING"}
              >
                <SelectTrigger
                  {...fieldA11y(id("batch"), e?.deliveryBatchSeq?.message)}
                  aria-label={`Đợt ${n} — đợt giao`}
                  className={FORM_SELECT_CLASS}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BATCH}>—</SelectItem>
                  {Array.from({ length: batchCount }).map((_, seq) => (
                    <SelectItem key={seq} value={String(seq + 1)}>
                      Đợt giao {seq + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </FormSelect>
            )}
          />
          <FieldError id={id("batch")} message={e?.deliveryBatchSeq?.message} />
        </div>
      </div>
      <p id={`${id("days")}-hint`} className="text-ink-secondary text-xs">
        {dueRuleText({ milestone, dueDays, deliveryBatchSeq: batchSeq })}
      </p>
    </li>
  );
}
