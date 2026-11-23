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

import type { UseFormReturn } from "react-hook-form";
import type { ContractFormValues } from "../../sales-contract-form";

const SELECT = `${FORM_INPUT_CLASS} w-full border px-2`;
const NUM = `${FORM_INPUT_CLASS} text-right font-[family-name:var(--font-mono)] tabular-nums`;
const TD = "px-1 pt-1 align-top";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={`${id}-error`} className="text-danger mt-1 text-xs">
      {message}
    </p>
  ) : null;
}

/**
 * Một đợt thanh toán là một hàng của bảng lịch thanh toán (BO-UX-26): tên, mốc, tính theo, giá trị, số ngày sau mốc,
 * đợt giao gắn kèm; dưới hàng là quy tắc ra hạn ("Hạn = ngày ký + 3 ngày"). Lỗi gắn vào ô qua `fieldA11y`.
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
  return (
    <tbody className="border-border-default border-b last:border-b-0">
      <tr>
        <td className={TD}>
          <Input
            {...register(`paymentPlan.${index}.name`)}
            {...fieldA11y(id("name"), e?.name?.message)}
            aria-label={`Đợt ${n} — tên`}
            placeholder="Tên đợt"
            className={FORM_INPUT_CLASS}
          />
          <FieldError id={id("name")} message={e?.name?.message} />
        </td>
        <td className={TD}>
          <select
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
        </td>
        <td className={TD}>
          <select
            {...register(`paymentPlan.${index}.mode`)}
            aria-label={`Đợt ${n} — tính theo`}
            className={SELECT}
          >
            <option value="amount">Số tiền (₫)</option>
            <option value="percent">% tổng đơn</option>
          </select>
        </td>
        <td className={TD}>
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
          <FieldError id={id("value")} message={valueError} />
        </td>
        <td className={TD}>
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
        </td>
        <td className={TD}>
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
        </td>
        <td className={TD}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Xoá đợt thanh toán ${n}`}
            disabled={!canRemove}
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        </td>
      </tr>
      <tr>
        <td colSpan={7} className="px-1 pt-0.5 pb-2">
          <p id={`${id("days")}-hint`} className="text-ink-secondary text-xs">
            {dueRuleText({ milestone, dueDays, deliveryBatchSeq: batchSeq })}
          </p>
        </td>
      </tr>
    </tbody>
  );
}
