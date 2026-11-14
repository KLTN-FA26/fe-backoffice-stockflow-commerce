import { PAYMENT_LABELS } from "@/constants/labels-payment";

import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";

const L = PAYMENT_LABELS;

export const INSTALLMENT_COPY: LoadErrorCopy = {
  pageTitle: L.installments.pageTitle,
  notFoundTitle: L.installments.notFoundTitle,
  notFoundDescription: L.installments.notFoundDescription,
  forbiddenDescription: L.installments.forbiddenDescription,
  noReadDescription: L.installments.noReadDescription,
};

export const ORDER_INSTALLMENTS_COPY: LoadErrorCopy = {
  ...INSTALLMENT_COPY,
  notFoundTitle: L.installments.orderNotFoundTitle,
  notFoundDescription: L.installments.orderNotFoundDescription,
};

export const RECEIPT_COPY: LoadErrorCopy = {
  pageTitle: L.receipts.pageTitle,
  notFoundTitle: L.receipts.notFoundTitle,
  notFoundDescription: L.receipts.notFoundDescription,
  forbiddenDescription: L.receipts.forbiddenDescription,
  noReadDescription: L.receipts.noReadDescription,
};

export const REFUND_COPY: LoadErrorCopy = {
  pageTitle: L.refunds.pageTitle,
  notFoundTitle: L.refunds.notFoundTitle,
  notFoundDescription: L.refunds.notFoundDescription,
  forbiddenDescription: L.refunds.forbiddenDescription,
  noReadDescription: L.refunds.noReadDescription,
};

/** Số / mã: mono, tabular — cột số căn phải (data-table-mode-a). */
export const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums";
