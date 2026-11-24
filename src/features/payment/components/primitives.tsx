"use client";

import Link from "next/link";

import { PAYMENT_LABELS, REFUND_STATUS_LABELS } from "@/constants/labels-payment";
import {
  INSTALLMENT_DISPLAY_STATUS_BY_API,
  ORDER_PAYMENT_STATUS_BY_API,
  RECEIPT_STATUS_BY_API,
} from "@/constants/payment";
import { formatMoney } from "@/lib/format";
import { formatDate } from "@/lib/format/date";
import { PermittedLink } from "@/components/backoffice/PermittedLink";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO } from "./copy";

import type { ReactNode } from "react";
import type { PermissionCode } from "@/lib/auth";
import type {
  InstallmentDisplayStatus,
  OrderPaymentReadStatus,
  ReceiptReadStatus,
  RefundReadStatus,
} from "@/constants/payment";

const EMPTY = PAYMENT_LABELS.empty;

export function MoneyCell({ amount, currency }: { amount: number; currency: string }) {
  return <span className={MONO}>{formatMoney(amount, currency)}</span>;
}

export function DateCell({ iso }: { iso: string | null | undefined }) {
  return <span className="text-ink-secondary tabular-nums">{iso ? formatDate(iso) : EMPTY}</span>;
}

export function InstallmentStatusDot({ status }: { status: InstallmentDisplayStatus }) {
  return <StatusDot domain="payment" status={INSTALLMENT_DISPLAY_STATUS_BY_API[status]} />;
}

export function ReceiptStatusDot({ status }: { status: ReceiptReadStatus }) {
  return <StatusDot domain="payment" status={RECEIPT_STATUS_BY_API[status]} />;
}

export function OrderPaymentStatusDot({ status }: { status: OrderPaymentReadStatus }) {
  return <StatusDot domain="payment" status={ORDER_PAYMENT_STATUS_BY_API[status]} />;
}

const REFUND_TONE: Record<RefundReadStatus, string> = {
  NONE: "bg-neutral",
  PENDING: "bg-warning",
  PARTIALLY_REFUNDED: "bg-warning",
  REFUNDED: "bg-positive",
  UNKNOWN: "bg-neutral",
};

/** Tình trạng hoàn tiền là giá trị suy ra (docs 15 §5.3), không phải union trạng thái → không qua status-map. */
export function RefundStateDot({ status }: { status: RefundReadStatus }) {
  return (
    <span className="text-ink-primary inline-flex items-center gap-2 text-[0.8125rem] font-medium">
      <span aria-hidden="true" className={`size-2.5 rounded-full ${REFUND_TONE[status]}`} />
      {REFUND_STATUS_LABELS[status]}
    </span>
  );
}

const CODE_LINK_CLASS = `text-accent-text font-medium hover:underline ${MONO}`;

/**
 * Mã chứng từ dẫn tới trang chi tiết. Có `permission` (VIEW_PAGE của trang đích, AUTH-8) mà người xem thiếu thì chỉ
 * hiện mã dạng chữ — UI-only, Backend phải re-check.
 */
export function CodeLink({
  href,
  permission,
  children,
}: {
  href: string;
  permission?: PermissionCode;
  children: ReactNode;
}) {
  if (permission)
    return (
      <PermittedLink
        permission={permission}
        href={href}
        className={CODE_LINK_CLASS}
        plainClassName={MONO}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </PermittedLink>
    );
  return (
    <Link href={href} className={CODE_LINK_CLASS} onClick={(event) => event.stopPropagation()}>
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
