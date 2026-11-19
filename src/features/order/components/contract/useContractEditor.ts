"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ApiError } from "@/lib/api/error";

import { getPaymentPlanSuggestion } from "../../sales-contract-api";
import {
  contractFormSchema,
  toContractDraftBody,
  toContractForm,
  toInstallmentForm,
} from "../../sales-contract-form";
import { contractErrorMessage, useEditSalesContract } from "../../sales-contract-mutations";

import type { Path } from "react-hook-form";
import type { ContractFormOutput, ContractFormValues } from "../../sales-contract-form";
import type { SalesContract } from "../../sales-contract-schemas";

/**
 * `fieldErrors[].field` của BE → đường dẫn form. `deliverySchedule[i].lines[j]` đếm theo dòng ĐÃ GỬI (bỏ dòng 0 thùng)
 * → đổi về chỉ số dòng đơn của form; `paymentPlan[i].amount|percent` → ô giá trị.
 */
export function contractFieldPath(field: string, values: ContractFormValues): string {
  const line = /^deliverySchedule\[(\d+)\]\.lines\[(\d+)\]\.(\w+)$/.exec(field);
  if (line) {
    const batch = values.deliverySchedule[Number(line[1])];
    const sent = (batch?.lines ?? [])
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => Number(entry.cartons) > 0);
    const index = sent[Number(line[2])]?.index ?? Number(line[2]);
    return `deliverySchedule.${line[1]}.lines.${index}.cartons`;
  }
  const plan = /^paymentPlan\[(\d+)\]\.(amount|percent)$/.exec(field);
  if (plan) return `paymentPlan.${plan[1]}.value`;
  if (field === "deliverySchedule" || field === "paymentPlan") return `${field}.root`;
  return field.replace(/\[(\d+)\]/g, ".$1");
}

export const NEEDS_CREDIT_HINT = " Đổi đợt Sau giao sang Trước giao, hoặc cấp hạn mức cho khách.";

export function useContractEditor({
  contract,
  orderLineIds,
  onSaved,
}: {
  contract: SalesContract;
  orderLineIds: readonly string[];
  onSaved: () => void;
}) {
  const form = useForm<ContractFormValues, unknown, ContractFormOutput>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: toContractForm(contract, orderLineIds),
    mode: "onTouched",
  });
  const edit = useEditSalesContract();
  const [formError, setFormError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const onError = (error: unknown) => {
    const values = form.getValues();
    const list = error instanceof ApiError ? (error.fieldErrorList ?? []) : [];
    for (const entry of list)
      form.setError(contractFieldPath(entry.field, values) as Path<ContractFormValues>, {
        type: "server",
        message: entry.message,
      });
    const needsCredit = error instanceof ApiError && error.code === "PAYMENT_SCHEDULE_NEEDS_CREDIT";
    setFormError(contractErrorMessage(error) + (needsCredit ? NEEDS_CREDIT_HINT : ""));
  };

  const submit = form.handleSubmit((values) => {
    setFormError(null);
    edit.mutate(
      { orderId: contract.orderId, version: contract.version, body: toContractDraftBody(values) },
      { onSuccess: onSaved, onError },
    );
  });

  /** Gợi ý số tiền theo đợt giao (`GET …/payment-plan-suggestion`) — điền bảng, Sale vẫn sửa được. */
  const suggest = async () => {
    setSuggesting(true);
    try {
      const suggestion = await getPaymentPlanSuggestion(contract.orderId);
      form.setValue(
        "paymentPlan",
        suggestion.paymentPlan.map((entry) => ({
          ...toInstallmentForm(entry),
          mode: "amount",
          value: String(entry.amount),
        })),
        { shouldDirty: true, shouldValidate: true },
      );
    } catch (error) {
      setFormError(contractErrorMessage(error));
    } finally {
      setSuggesting(false);
    }
  };

  return { form, submit, formError, pending: edit.isPending, suggest, suggesting };
}
