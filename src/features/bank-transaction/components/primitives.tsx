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
