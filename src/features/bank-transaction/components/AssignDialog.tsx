"use client";

import { useState } from "react";

import { BANK_TRANSACTION_LIMITS } from "@/constants/bank-transaction";
import { formatMoney } from "@/lib/format/money";
import { CustomerPicker } from "@/components/backoffice/CustomerPicker";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Textarea } from "@/components/ui/textarea";

import { bankTransactionErrorMessage, useAssignBankTransaction } from "../mutations";
import { assignInputFor } from "../schemas";
import { useCustomerInstallments } from "../queries";
import { assignedTotal, payableInstallments } from "../selectors";

import { InstallmentLines } from "./InstallmentLines";

import type { BankTransaction } from "../types";

/**
 * Gán giao dịch chờ xử lý vào đợt của MỘT khách → BE lập phiếu thu (mã tham chiếu, ngày nhận lấy từ giao dịch). Điền sẵn
 * khách / đợt gợi ý của giao dịch. Tổng ≤ số tiền giao dịch (BE BANK_TRANSACTION_OVER_ASSIGNED); phần dư xử lý ở phần
 * mềm kế toán (15 BR-06).
 */
export function AssignDialog({
  transaction,
  onClose,
}: {
  transaction: BankTransaction;
  onClose: () => void;
}) {
  const assign = useAssignBankTransaction();
  const [customerId, setCustomerId] = useState(transaction.customerId ?? "");
  // installmentId → số tiền đang nhập (chuỗi để giữ đúng thứ người dùng gõ). Chưa chạm vào → điền sẵn đợt gợi ý của
  // giao dịch, CHỈ khi đợt đó còn nhận tiền, với min(số tiền giao dịch, còn phải thu) — đợt gợi ý NOT_PAYABLE không
  // được tính / gửi ngầm mà Kế toán không có dòng để bỏ.
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const installments = useCustomerInstallments(customerId || null, true);
  const payable = payableInstallments(installments.data ?? []);
  const suggested =
    !touched && customerId === transaction.customerId
      ? payable.find((row) => row.installmentId === transaction.installmentId)
      : undefined;
  const effective = touched
    ? amounts
    : suggested
      ? { [suggested.installmentId]: String(Math.min(transaction.amount, suggested.outstanding)) }
      : {};
  const lines = Object.entries(effective)
    .filter(([id]) => payable.some((row) => row.installmentId === id))
    .map(([installmentId, amount]) => ({ installmentId, amount }));
  const parsed = assignInputFor(transaction.amount).safeParse({ customerId, lines, note });
  const total = assignedTotal(lines);
  const over = total > transaction.amount;
  const money = (amount: number) => formatMoney(amount, transaction.currency);

  const submit = () => {
    if (!parsed.success) return;
    setError(null);
    assign.mutate(
      { id: transaction.id, body: parsed.data },
      { onSuccess: onClose, onError: (e) => setError(bankTransactionErrorMessage(e)) },
    );
  };

  return (
    <FormDialog
      open
      className="sm:max-w-[640px]"
      onOpenChange={(open) => !open && !assign.isPending && onClose()}
    >
      <FormDialogBody
        title="Gán vào đợt thanh toán"
        description={`Giao dịch ${money(transaction.amount)}. Hệ thống lập phiếu thu theo mã tham chiếu và ngày của giao dịch.`}
        submitLabel="Gán và lập phiếu thu"
        canSubmit={parsed.success}
        isPending={assign.isPending}
        error={error}
        onSubmit={submit}
        onCancel={onClose}
      >
        <CustomerPicker
          idPrefix="bank-assign"
          value={customerId}
          onChange={(id) => {
            setCustomerId(id);
            setAmounts({});
            setTouched(true);
          }}
        />
        {customerId && (
          <InstallmentLines
            state={installments}
            rows={payable}
            amounts={effective}
            onChange={(next) => {
              setTouched(true);
              setAmounts(next);
            }}
            remaining={transaction.amount - total}
          />
        )}
        <p
          className={`text-[0.8125rem] tabular-nums ${over ? "text-danger" : "text-ink-secondary"}`}
          role={over ? "alert" : undefined}
        >
          Đã gán {money(total)} / {money(transaction.amount)}
          {over && " — vượt số tiền của giao dịch"}
        </p>
        <FormField id="bank-assign-note" label="Ghi chú" hint="Không bắt buộc, tối đa 500 ký tự.">
          <Textarea
            id="bank-assign-note"
            rows={2}
            maxLength={BANK_TRANSACTION_LIMITS.noteMax}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={FORM_TEXTAREA_CLASS}
          />
        </FormField>
      </FormDialogBody>
    </FormDialog>
  );
}
