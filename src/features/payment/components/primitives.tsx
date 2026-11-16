"use client";

import Link from "next/link";

import { PAYMENT_LABELS, REFUND_STATUS_LABELS } from "@/constants/labels-payment";
import {
  INSTALLMENT_STATUS_BY_API,
  ORDER_PAYMENT_STATUS_BY_API,
  RECEIPT_STATUS_BY_API,
} from "@/constants/payment";
import { formatMoney } from "@/lib/format";
import { formatDate } from "@/lib/format/date";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO } from "./copy";

import type { ReactNode } from "react";
import type {
  InstallmentApiStatus,
  OrderPaymentApiStatus,
  ReceiptApiStatus,
  RefundApiStatus,
} from "@/constants/payment";

const EMPTY = PAYMENT_LABELS.empty;

export function MoneyCell({ amount, currency }: { amount: number; currency: string }) {
  return <span className={MONO}>{formatMoney(amount, currency)}</span>;
}

export function DateCell({ iso }: { iso: string | null | undefined }) {
  return <span className="text-ink-secondary tabular-nums">{iso ? formatDate(iso) : EMPTY}</span>;
}

export function InstallmentStatusDot({ status }: { status: InstallmentApiStatus }) {
  return <StatusDot domain="payment" status={INSTALLMENT_STATUS_BY_API[status]} />;
}

export function ReceiptStatusDot({ status }: { status: ReceiptApiStatus }) {
  return <StatusDot domain="payment" status={RECEIPT_STATUS_BY_API[status]} />;
}

export function OrderPaymentStatusDot({ status }: { status: OrderPaymentApiStatus }) {
  return <StatusDot domain="payment" status={ORDER_PAYMENT_STATUS_BY_API[status]} />;
}

const REFUND_TONE: Record<RefundApiStatus, string> = {
  NONE: "bg-neutral",
  PENDING: "bg-warning",
  PARTIALLY_REFUNDED: "bg-warning",
  REFUNDED: "bg-positive",
};

/** Tình trạng hoàn tiền là giá trị suy ra (docs 15 §5.3), không phải union trạng thái → không qua status-map. */
export function RefundStateDot({ status }: { status: RefundApiStatus }) {
  return (
    <span className="text-ink-primary inline-flex items-center gap-2 text-[0.8125rem] font-medium">
      <span aria-hidden="true" className={`size-2.5 rounded-full ${REFUND_TONE[status]}`} />
      {REFUND_STATUS_LABELS[status]}
    </span>
  );
}

export function CodeLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`text-accent font-medium hover:underline ${MONO}`}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </Link>
  );
}

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-ink-tertiary">{label}</dt>
      <dd className="text-ink-primary min-w-0 break-words">{children}</dd>
    </div>
  );
}
