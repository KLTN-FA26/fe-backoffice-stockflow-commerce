"use client";

import Link from "next/link";

import { EINVOICE_STATUS_BY_API } from "@/constants/einvoice";
import { EINVOICE_TYPE_LABELS } from "@/constants/labels-einvoice";
import { formatMoney } from "@/lib/format";
import { formatDate } from "@/lib/format/date";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO } from "./copy";

import type { ReactNode } from "react";
import type { EInvoiceStatus, EInvoiceType } from "@/constants/einvoice";

const EMPTY = "—";

export function MoneyCell({ amount, currency = "VND" }: { amount: number; currency?: string }) {
  return <span className={MONO}>{formatMoney(amount, currency)}</span>;
}

export function DateCell({ iso }: { iso: string | null | undefined }) {
  return <span className="text-ink-secondary tabular-nums">{iso ? formatDate(iso) : EMPTY}</span>;
}

/** Trạng thái hoá đơn qua `StatusDot` (domain `invoice`, nhãn ở status-map). */
export function EInvoiceStatusDot({ status }: { status: EInvoiceStatus }) {
  return <StatusDot domain="invoice" status={EINVOICE_STATUS_BY_API[status]} />;
}

export function TypeText({ type, adjusted }: { type: EInvoiceType; adjusted?: boolean }) {
  return (
    <span className="text-ink-secondary">
      {EINVOICE_TYPE_LABELS[type]}
      {adjusted ? " · có điều chỉnh" : ""}
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
