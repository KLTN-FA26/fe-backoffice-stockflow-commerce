"use client";

import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PAYMENT_LIMITS } from "@/constants/payment";

import { buildReceiptInputSchema, todayInVietnam } from "./input-schemas";
import { usePayableInstallmentsOf } from "./queries";
import { payableInstallments } from "./selectors";

import type { Installment, ReceiptFormValues, ReceiptInput } from "./types";

/**
 * Form lập phiếu thu từ một đợt (docs 15 §4.2 bước 6): khách lấy từ đợt, các đợt có thể thêm là đợt còn
 * nhận tiền của CÙNG khách và cùng loại tiền (một phiếu một loại tiền). Đợt bấm vào luôn chọn được, kể cả
 * khi danh sách của khách chưa tải xong; dòng đầu điền sẵn đúng số còn phải thu.
 */
export function useReceiptForm(initial: Installment) {
  const payable = usePayableInstallmentsOf(initial.customerId, PAYMENT_LIMITS.pageSizeMax);
  const choices = useMemo(() => {
    const others = payableInstallments(payable.data?.items ?? []);
    return [initial, ...others.filter((i) => i.installmentId !== initial.installmentId)].filter(
      (i) => i.currency === initial.currency,
    );
  }, [payable.data, initial]);
  const schema = useMemo(
    () => buildReceiptInputSchema((id) => choices.find((c) => c.installmentId === id)?.outstanding),
    [choices],
  );
  const form = useForm<ReceiptFormValues, unknown, ReceiptInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerId: initial.customerId,
      reference: "",
      receivedOn: todayInVietnam(),
      note: "",
      lines: [{ installmentId: initial.installmentId, amount: String(initial.outstanding) }],
    },
  });
  const lines = useWatch({ control: form.control, name: "lines" });
  return { form, lines, choices, loadFailed: payable.isError };
}
