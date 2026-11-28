"use client";

import { useRef, useState } from "react";
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
import {
  CONTRACT_EDIT_LOCK_MESSAGE,
  contractErrorMessage,
  useEditSalesContract,
} from "../../sales-contract-mutations";

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

/** Gợi ý tính theo lịch giao ĐÃ LƯU (BE đọc hợp đồng đang lưu) — lịch giao đang sửa thì lưu trước. */
export const SUGGEST_NEEDS_SAVED_SCHEDULE =
  "Lịch giao đang sửa chưa lưu. Lưu hợp đồng trước rồi bấm Gợi ý: số tiền gợi ý tính theo lịch giao đã lưu.";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

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
  /** Hỏi lại trước khi gợi ý thay lịch thanh toán Sale đã sửa (WF-02 audit, mục 7). */
  const [confirmingSuggest, setConfirmingSuggest] = useState(false);
  // Mốc so sánh: lịch giao / lịch thanh toán như đã lưu, và lịch thanh toán lần gợi ý gần nhất. Luôn giữ BẢN SAO:
  // `getValues` trả về chính mảng form đang giữ, và sửa một ô đổi mảng đó tại chỗ — giữ tham chiếu thì mốc so sánh đổi
  // theo, lần "Gợi ý" sau không còn thấy Sale đã sửa và ghi đè không hỏi.
  const [initial] = useState(() => ({
    schedule: structuredClone(form.getValues("deliverySchedule")),
    plan: structuredClone(form.getValues("paymentPlan")),
  }));
  const savedSchedule = useRef(initial.schedule);
  const untouchedPlan = useRef(initial.plan);
  // Version của bản mà các ô đang hiển thị. `contract` là prop sống: đổi tab thì query tải lại và `contract.version` đổi,
  // còn các ô vẫn là bản cũ. Gửi version sống kèm giá trị cũ sẽ ghi đè bản mới mà BE không báo 409 (WF-02 mục 7),
  // nên chỉ gửi `baseVersion` và chờ Sale bấm "Tải lại theo bản mới".
  const [baseVersion, setBaseVersion] = useState(contract.version);
  const stale = contract.version !== baseVersion;

  const reload = () => {
    form.reset(toContractForm(contract, orderLineIds));
    savedSchedule.current = structuredClone(form.getValues("deliverySchedule"));
    untouchedPlan.current = structuredClone(form.getValues("paymentPlan"));
    setBaseVersion(contract.version);
    setFormError(null);
  };

  const onError = (error: unknown) => {
    const values = form.getValues();
    const list = error instanceof ApiError ? (error.fieldErrorList ?? []) : [];
    for (const entry of list)
      form.setError(contractFieldPath(entry.field, values) as Path<ContractFormValues>, {
        type: "server",
        message: entry.message,
      });
    const needsCredit = error instanceof ApiError && error.code === "PAYMENT_SCHEDULE_NEEDS_CREDIT";
    if (error instanceof ApiError && error.code === "OPTIMISTIC_LOCK") {
      setFormError(CONTRACT_EDIT_LOCK_MESSAGE);
      return;
    }
    setFormError(contractErrorMessage(error) + (needsCredit ? NEEDS_CREDIT_HINT : ""));
  };

  const submit = form.handleSubmit((values) => {
    setFormError(null);
    edit.mutate(
      {
        orderId: contract.orderId,
        version: baseVersion,
        body: toContractDraftBody(values, contract.standardTerms),
      },
      { onSuccess: onSaved, onError },
    );
  });

  /**
   * Gợi ý số tiền theo đợt giao (`GET …/payment-plan-suggestion`) — điền bảng, Sale vẫn sửa được. BE tính theo lịch
   * giao đã lưu, nên lịch giao đang sửa phải lưu trước; lịch thanh toán Sale đã sửa thì hỏi trước khi thay
   * (`confirmed` = Sale đã đồng ý thay).
   */
  const suggest = async (confirmed = false) => {
    if (!same(form.getValues("deliverySchedule"), savedSchedule.current)) {
      setFormError(SUGGEST_NEEDS_SAVED_SCHEDULE);
      return;
    }
    if (!confirmed && !same(form.getValues("paymentPlan"), untouchedPlan.current)) {
      setConfirmingSuggest(true);
      return;
    }
    setConfirmingSuggest(false);
    setFormError(null);
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
      untouchedPlan.current = structuredClone(form.getValues("paymentPlan"));
    } catch (error) {
      setFormError(contractErrorMessage(error));
    } finally {
      setSuggesting(false);
    }
  };

  return {
    form,
    submit,
    formError,
    stale,
    reload,
    pending: edit.isPending,
    suggest,
    suggesting,
    confirmingSuggest,
    cancelSuggest: () => setConfirmingSuggest(false),
  };
}
