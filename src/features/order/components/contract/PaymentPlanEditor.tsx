"use client";

import { useFieldArray, useWatch } from "react-hook-form";
import { Plus } from "lucide-react";

import { formatMoney } from "@/lib/format/money";
import { Button } from "@/components/ui/button";

import { planTotal } from "../../sales-contract-rules";

import { PaymentPlanRow } from "./PaymentPlanRow";

import type { UseFormReturn } from "react-hook-form";
import type { ContractFormValues } from "../../sales-contract-form";

const TH = "px-1 pb-1 font-medium";

/**
 * Lịch thanh toán: tên, mốc, số tiền hoặc %, số ngày (BEFORE_DELIVERY không có), đợt giao gắn kèm (ON_SIGNING
 * không gắn). F-04.2: hiện "Tổng các đợt / Tổng đơn có thuế" và chênh lệch trước khi lưu; % do BE quy ra tiền.
 */
export function PaymentPlanEditor({
  form,
  totalWithTax,
  currency,
}: {
  form: UseFormReturn<ContractFormValues>;
  totalWithTax: number;
  currency: string;
}) {
  const { control, formState } = form;
  const plan = useFieldArray({ control, name: "paymentPlan" });
  const [entries, batches] = useWatch({ control, name: ["paymentPlan", "deliverySchedule"] });
  const sum = planTotal(entries ?? [], totalWithTax);
  const diff = sum - totalWithTax;
  const errors = formState.errors.paymentPlan;
  const listError = errors?.root?.message ?? errors?.message;

  return (
    <fieldset className="space-y-2">
      <legend className="text-ink-primary text-sm font-semibold">Lịch thanh toán</legend>
      {listError && (
        <p role="alert" className="text-danger text-xs">
          {listError}
        </p>
      )}
      {/* BO-UX-26: bảng có tiêu đề cột hiện rõ — các số này vào hợp đồng và quyết định mọi ngày đến hạn. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-[0.8125rem]">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[13%]" />
            <col className="w-[14%]" />
            <col className="w-[18%]" />
            <col className="w-[13%]" />
            <col className="w-[14%]" />
            <col className="w-10" />
          </colgroup>
          <thead>
            <tr className="text-ink-secondary text-left text-xs">
              <th scope="col" className={TH}>
                Tên đợt
              </th>
              <th scope="col" className={TH}>
                Mốc
              </th>
              <th scope="col" className={TH}>
                Tính theo
              </th>
              <th scope="col" className={TH}>
                Giá trị (₫ / %)
              </th>
              <th scope="col" className={TH}>
                Hạn (số ngày sau mốc)
              </th>
              <th scope="col" className={TH}>
                Gắn đợt giao
              </th>
              <th scope="col" className={TH}>
                <span className="sr-only">Xoá</span>
              </th>
            </tr>
          </thead>
          {plan.fields.map((field, i) => (
            <PaymentPlanRow
              key={field.id}
              form={form}
              index={i}
              batchCount={(batches ?? []).length}
              canRemove={plan.fields.length > 1}
              onRemove={() => plan.remove(i)}
            />
          ))}
        </table>
      </div>
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
