"use client";

import Link from "next/link";

import { RETURN_LABELS, RETURN_RECEIPT_LABELS } from "@/constants/labels-return";
import { RETURN_RECEIPT_STATUS_BY_API, RETURN_STATUS_BY_API } from "@/constants/returns";
import { formatMoney } from "@/lib/format";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { StatusDot } from "@/components/shared/StatusDot";

import type { ReactNode } from "react";
import type { ReturnApiStatus, ReturnReceiptApiStatus } from "@/constants/returns";
import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";

/** Số / mã: mono, tabular — cột số căn phải (data-table-mode-a). */
export const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums";
export const EMPTY = "—";

export const RETURN_COPY: LoadErrorCopy = {
  pageTitle: RETURN_LABELS.pageTitle,
  notFoundTitle: RETURN_LABELS.notFoundTitle,
  notFoundDescription: RETURN_LABELS.notFoundDescription,
  forbiddenDescription: RETURN_LABELS.forbiddenDescription,
  noReadDescription: RETURN_LABELS.noReadDescription,
};

export const RETURN_RECEIPT_COPY: LoadErrorCopy = {
  pageTitle: RETURN_RECEIPT_LABELS.pageTitle,
  notFoundTitle: RETURN_RECEIPT_LABELS.notFoundTitle,
  notFoundDescription: RETURN_RECEIPT_LABELS.notFoundDescription,
  forbiddenDescription: RETURN_RECEIPT_LABELS.forbiddenDescription,
  noReadDescription: RETURN_RECEIPT_LABELS.noReadDescription,
};

export function ReturnStatusDot({ status }: { status: ReturnApiStatus }) {
  return <StatusDot domain="rma" status={RETURN_STATUS_BY_API[status]} />;
}

export function ReturnReceiptStatusDot({ status }: { status: ReturnReceiptApiStatus }) {
  return <StatusDot domain="receipt" status={RETURN_RECEIPT_STATUS_BY_API[status]} />;
}

export function Money({
  amount,
  currency,
}: {
  amount: number | null | undefined;
  currency: string;
}) {
  return <span className={MONO}>{amount == null ? EMPTY : formatMoney(amount, currency)}</span>;
}

export function When({
  iso,
  withTime = true,
}: {
  iso: string | null | undefined;
  withTime?: boolean;
}) {
  return (
    <span className="text-ink-secondary tabular-nums">
      {iso ? (withTime ? formatDateTime(iso) : formatDate(iso)) : EMPTY}
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

export function InfoList({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-[minmax(150px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
      {children}
    </dl>
  );
}
