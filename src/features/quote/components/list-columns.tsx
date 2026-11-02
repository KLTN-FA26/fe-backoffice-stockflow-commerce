"use client";

import Link from "next/link";

import {
  ADMIN_ROUTES,
  PAYMENT_TERM_LABELS,
  QUOTE_API_STATUSES,
  QUOTE_STATUS_BY_API,
} from "@/constants";

import { formatDate } from "@/lib/format/date";

import { isExpired } from "@/features/quote/selectors";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO, quoteStatusLabel } from "./copy";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { QuoteRow } from "@/features/quote/types";

export const STATUS_OPTIONS = QUOTE_API_STATUSES.map((value) => ({
  value,
  label: quoteStatusLabel(value),
}));

export const SORTABLE = new Set(["quoteNumber", "status", "validUntil", "createdAt"]);

export const COLUMNS: ColumnDef<QuoteRow>[] = [
  {
    key: "quoteNumber",
    header: "Số báo giá",
    sortable: true,
    cell: (row) => (
      <Link
        href={ADMIN_ROUTES.quotes.detail(row.id)}
        className={`text-accent font-medium hover:underline ${MONO}`}
        onClick={(event) => event.stopPropagation()}
      >
        {row.quoteNumber}
      </Link>
    ),
  },
  { key: "customer", header: "Khách hàng", cell: (row) => <CustomerName id={row.customerId} /> },
  {
    key: "status",
    header: "Trạng thái",
    sortable: true,
    cell: (row) => <StatusDot domain="order" status={QUOTE_STATUS_BY_API[row.status]} />,
  },
  {
    key: "revision",
    header: "Bản",
    align: "right",
    cell: (row) => <span className={MONO}>{row.revision}</span>,
  },
  {
    key: "paymentTerm",
    header: "Thanh toán",
    cell: (row) => (
      <span className="text-ink-secondary">{PAYMENT_TERM_LABELS[row.paymentTerm]}</span>
    ),
  },
  {
    key: "validUntil",
    header: "Hiệu lực đến",
    sortable: true,
    align: "right",
    cell: (row) => (
      <span
        className={`tabular-nums ${row.status === "SENT" && isExpired(row.validUntil) ? "text-danger" : "text-ink-secondary"}`}
      >
        {formatDate(row.validUntil)}
      </span>
    ),
  },
  {
    key: "order",
    header: "Đơn bán",
    cell: (row) =>
      row.convertedOrderId ? (
        <Link
          href={ADMIN_ROUTES.orders.detail(row.convertedOrderId)}
          className="text-accent hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          Xem đơn
        </Link>
      ) : (
        <span className="text-ink-tertiary">—</span>
      ),
  },
];
