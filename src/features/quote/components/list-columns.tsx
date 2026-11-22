"use client";

import Link from "next/link";

import {
  ADMIN_ROUTES,
  QUOTE_API_STATUSES,
  QUOTE_STATUS_BY_API,
  QUOTE_STATUS_LABELS,
} from "@/constants";

import { formatDate, formatDateTime } from "@/lib/format/date";

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
        className={`text-accent-text font-medium hover:underline ${MONO}`}
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
    cell: (row) => (
      <StatusDot
        domain="order"
        status={QUOTE_STATUS_BY_API[row.status]}
        label={QUOTE_STATUS_LABELS[row.status]}
      />
    ),
  },
  {
    key: "revision",
    header: "Bản",
    align: "right",
    cell: (row) => <span className={MONO}>{row.revision}</span>,
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
    key: "sentAt",
    header: "Ngày gửi",
    align: "right",
    cell: (row) => (
      <span className="text-ink-secondary tabular-nums">
        {row.sentAt ? formatDateTime(row.sentAt) : "—"}
      </span>
    ),
  },
  {
    key: "order",
    header: "Đơn đã tạo",
    cell: (row) =>
      row.convertedOrderId ? (
        <Link
          href={ADMIN_ROUTES.orders.detail(row.convertedOrderId)}
          className="text-accent-text hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          Mở đơn
        </Link>
      ) : (
        <span className="text-ink-tertiary">—</span>
      ),
  },
];
