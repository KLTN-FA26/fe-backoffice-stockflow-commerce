"use client";

import { useFieldArray, useWatch } from "react-hook-form";
import { Plus } from "lucide-react";

import { formatMoney } from "@/lib/format/money";
import { Button } from "@/components/ui/button";

import { planDeferredAmount, planTotal } from "../../sales-contract-rules";

import { ContractCreditPosition } from "./ContractCreditPosition";
import { PaymentPlanRow } from "./PaymentPlanRow";

import type { UseFormReturn } from "react-hook-form";
import type { ContractFormValues } from "../../sales-contract-form";

/**
 * Lịch thanh toán: mỗi đợt một thẻ — tên, mốc, số tiền hoặc %, số ngày (BEFORE_DELIVERY không có), đợt giao gắn kèm
 * (ON_SIGNING không gắn). F-04.2: hiện "Tổng các đợt / Tổng đơn có thuế" và chênh lệch trước khi lưu; % do BE quy ra tiền.
 * bo-20: dưới tổng là công nợ của khách so với phần trả sau giao của lịch này (`ContractCreditPosition`).
 */
export function PaymentPlanEditor({
  form,
  totalWithTax,
  currency,
  customerId,
}: {
  form: UseFormReturn<ContractFormValues>;
  totalWithTax: number;
  currency: string;
  /** Khách của đơn — đọc công nợ hiện tại; null thì không hiện khối công nợ. */
  customerId: string | null;
}) {
  const { control, formState } = form;
  const plan = useFieldArray({ control, name: "paymentPlan" });
  const [entries, batches] = useWatch({ control, name: ["paymentPlan", "deliverySchedule"] });
  const sum = planTotal(entries ?? [], totalWithTax);
  const diff = sum - totalWithTax;
  const errors = formState.errors.paymentPlan;
  const listError = errors?.root?.message ?? errors?.message;

  return (
    // min-w-0: fieldset mặc định rộng tối thiểu bằng nội dung — thẻ đợt sẽ tràn khỏi khung thay vì co lại (bo-20)
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-ink-primary text-sm font-semibold">Lịch thanh toán</legend>
      {listError && (
        <p role="alert" className="text-danger text-xs">
          {listError}
        </p>
      )}
      {/* S06-2: mỗi đợt một thẻ 2 dòng (tên + mốc + xoá / giá trị + hạn + đợt giao) — không còn bảng 860px phải cuộn ngang. */}
      <ul className="space-y-2">
        {plan.fields.map((field, i) => (
          <PaymentPlanRow
            key={field.id}
            form={form}
            index={i}
            batchCount={(batches ?? []).length}
            canRemove={plan.fields.length > 1}
            onRemove={() => plan.remove(i)}
            totalWithTax={totalWithTax}
            currency={currency}
          />
        ))}
      </ul>
      <p
        className={`text-[0.8125rem] ${diff === 0 ? "text-ink-secondary" : "text-danger"}`}
        aria-live="polite"
      >
        Tổng các đợt = <strong className="tabular-nums">{formatMoney(sum, currency)}</strong> / Tổng
        đơn có thuế ={" "}
        <strong className="tabular-nums">{formatMoney(totalWithTax, currency)}</strong>
        {diff !== 0 &&
          ` — chênh ${formatMoney(Math.abs(diff), currency)} (${diff > 0 ? "dư" : "thiếu"})`}
      </p>
      <ContractCreditPosition
        customerId={customerId}
        deferred={planDeferredAmount(entries ?? [], totalWithTax)}
        currency={currency}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={plan.fields.length >= 20}
        onClick={() =>
          plan.append({
            name: "",
            milestone: "AFTER_DELIVERY",
            mode: "amount",
            value: "",
            dueDays: "",
            deliveryBatchSeq: "",
          })
        }
      >
        <Plus className="size-3.5" /> Thêm đợt thanh toán
      </Button>
    </fieldset>
  );
}
