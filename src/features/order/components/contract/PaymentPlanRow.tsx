"use client";

import { useWatch } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { CONTRACT_MILESTONE_LABELS, CONTRACT_MILESTONES } from "@/constants";
import { FORM_INPUT_CLASS } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DEFAULT_ON_SIGNING_DUE_DAYS } from "../../sales-contract-form";

import type { UseFormReturn } from "react-hook-form";
import type { ContractFormValues } from "../../sales-contract-form";

const SELECT = `${FORM_INPUT_CLASS} border px-2`;
const NUM = `${FORM_INPUT_CLASS} text-right font-[family-name:var(--font-mono)] tabular-nums`;

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-danger mt-1 text-xs">{message}</p> : null;
}

/** Một đợt thanh toán: tên, mốc, số tiền / %, số ngày, đợt giao gắn kèm. */
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
  const milestone = useWatch({ control, name: `paymentPlan.${index}.milestone` });
  return (
    <div className="grid grid-cols-[1.4fr_1fr_0.8fr_1fr_0.6fr_0.7fr_auto] items-start gap-2">
      <div>
        <Input
          {...register(`paymentPlan.${index}.name`)}
          aria-label={`Đợt ${index + 1} — tên`}
          placeholder="Tên đợt"
          className={FORM_INPUT_CLASS}
        />
        <FieldError message={e?.name?.message} />
      </div>
      <select
        {...register(`paymentPlan.${index}.milestone`, {
          // N10: an ON_SIGNING row left without a number of days defaults to the BE's 3 days.
          onChange: (event: { target: { value: string } }) => {
            if (event.target.value === "ON_SIGNING" && !getValues(`paymentPlan.${index}.dueDays`))
              setValue(`paymentPlan.${index}.dueDays`, String(DEFAULT_ON_SIGNING_DUE_DAYS));
          },
        })}
        aria-label={`Đợt ${index + 1} — mốc`}
        className={SELECT}
      >
        {CONTRACT_MILESTONES.map((value) => (
          <option key={value} value={value}>
            {CONTRACT_MILESTONE_LABELS[value]}
          </option>
        ))}
      </select>
      <select
        {...register(`paymentPlan.${index}.mode`)}
        aria-label={`Đợt ${index + 1} — tính theo`}
        className={SELECT}
      >
        <option value="amount">Số tiền</option>
        <option value="percent">%</option>
      </select>
      <div>
        <Input
          {...register(`paymentPlan.${index}.value`)}
          aria-label={`Đợt ${index + 1} — giá trị`}
          inputMode="decimal"
          className={NUM}
        />
        <FieldError message={e?.value?.message ?? e?.message} />
      </div>
      <div>
        <Input
          {...register(`paymentPlan.${index}.dueDays`)}
          aria-label={`Đợt ${index + 1} — số ngày`}
          placeholder={milestone === "ON_SIGNING" ? String(DEFAULT_ON_SIGNING_DUE_DAYS) : "Ngày"}
          disabled={milestone === "BEFORE_DELIVERY"}
          inputMode="numeric"
          className={NUM}
        />
        <FieldError message={e?.dueDays?.message} />
      </div>
      <div>
        <select
          {...register(`paymentPlan.${index}.deliveryBatchSeq`)}
          aria-label={`Đợt ${index + 1} — đợt giao`}
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
        <FieldError message={e?.deliveryBatchSeq?.message} />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Xoá đợt thanh toán ${index + 1}`}
        disabled={!canRemove}
        onClick={onRemove}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
