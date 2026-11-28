"use client";

import {
  BANK_TRANSACTION_LABELS,
  BANK_TRANSACTION_STATUS_BY_API,
} from "@/constants/bank-transaction";
import { StatusDot } from "@/components/shared/StatusDot";

import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";
import type { BankTransactionStatus } from "../types";

const L = BANK_TRANSACTION_LABELS;

export const MONO = "font-[family-name:var(--font-mono)] tabular-nums";

export const BANK_TRANSACTION_COPY: LoadErrorCopy = {
  pageTitle: L.pageTitle,
  notFoundTitle: L.notFoundTitle,
  notFoundDescription: L.notFoundDescription,
  forbiddenDescription: L.forbiddenDescription,
  noReadDescription: L.noReadDescription,
};

export function BankTransactionStatusDot({ status }: { status: BankTransactionStatus }) {
  return <StatusDot domain="payment" status={BANK_TRANSACTION_STATUS_BY_API[status]} size="sm" />;
}

/** Nhãn "Khớp số tiền": đợt còn phải thu đúng bằng số tiền giao dịch. Chữ ink, tông ở chấm (BO-UX-1). */
export function AmountMatchTag() {
  return (
    <span className="border-border-default bg-bg-subtle text-ink-secondary ml-2 inline-flex items-center gap-1 rounded-(--r-sm) border px-1.5 py-px font-sans text-[0.6875rem] font-medium">
      <span aria-hidden="true" className="bg-dot-positive size-1.5 rounded-full" />
      {L.assign.amountMatch}
    </span>
  );
}
