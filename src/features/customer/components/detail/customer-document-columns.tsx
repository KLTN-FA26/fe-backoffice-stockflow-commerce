"use client";

import Link from "next/link";

import { ADMIN_ROUTES, QUOTE_STATUS_BY_API, QUOTE_STATUS_LABELS } from "@/constants";
import { REPORT_ORDER_STATUS_TO_FE } from "@/constants/reporting";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { StatusDot } from "@/components/shared/StatusDot";

import { CUSTOMER_DOCUMENTS_COPY as L } from "./documents-copy";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { CustomerOrderRow, CustomerQuoteRow } from "@/features/customer/types";

const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums";
const LINK = `text-accent-text font-medium hover:underline ${MONO}`;
const MUTED = "text-ink-secondary text-[0.8125rem] tabular-nums";
const DASH = <span className="text-ink-tertiary">—</span>;

const lookup = (table: Readonly<Record<string, string>>, key: string) => table[key];

/** Danh sách đơn của khách trên trang Đơn hàng (lọc khách theo id, khoá URL `customer`). */
export const ordersOfCustomer = (customerId: string) =>
  `${ADMIN_ROUTES.orders.list}?customer=${encodeURIComponent(customerId)}`;

export const QUOTE_COLUMNS: ColumnDef<CustomerQuoteRow>[] = [
  {
    key: "quoteNumber",
    header: L.quotes.number,
    className: "min-w-44",
    cell: (row) => (
      <div className="flex min-w-0 flex-col">
        <Link href={ADMIN_ROUTES.quotes.detail(row.id)} className={LINK}>
          {row.quoteNumber}
          {row.revision > 1 && (
            <span className="text-ink-secondary font-normal"> · {L.revision(row.revision)}</span>
          )}
        </Link>
        {row.firstItemName && (
          <span className="text-ink-tertiary max-w-56 truncate text-xs" title={row.firstItemName}>
            {row.firstItemName}
          </span>
        )}
      </div>
    ),
  },
  {
    key: "status",
    header: L.quotes.status,
    cell: (row) => (
      <StatusDot
        domain="order"
        status={lookup(QUOTE_STATUS_BY_API, row.status) ?? row.status}
        label={lookup(QUOTE_STATUS_LABELS, row.status) ?? row.status}
      />
    ),
  },
  {
    key: "total",
    header: L.quotes.total,
    align: "right",
    className: "min-w-32",
    cell: (row) =>
      row.total != null ? <span className={MONO}>{formatMoney(row.total, "VND")}</span> : DASH,
  },
  {
    key: "validUntil",
    header: L.quotes.validUntil,
    cell: (row) =>
      row.validUntil ? <span className={MUTED}>{formatDate(row.validUntil)}</span> : DASH,
  },
  {
    key: "order",
    header: L.quotes.order,
    cell: (row) =>
      row.convertedOrderId ? (
        <Link href={ADMIN_ROUTES.orders.detail(row.convertedOrderId)} className={LINK}>
          {row.convertedOrderNumber ?? L.quotes.order}
        </Link>
      ) : (
        DASH
      ),
  },
  {
    key: "createdAt",
    header: L.quotes.createdAt,
    align: "right",
    cell: (row) => <span className={MUTED}>{formatDate(row.createdAt)}</span>,
  },
];

export const ORDER_COLUMNS: ColumnDef<CustomerOrderRow>[] = [
  {
    key: "orderNumber",
    header: L.orders.number,
    className: "min-w-44",
    cell: (row) => (
      <Link href={ADMIN_ROUTES.orders.detail(row.orderId)} className={LINK}>
        {row.orderNumber}
      </Link>
    ),
  },
  {
    key: "status",
    header: L.orders.status,
    cell: (row) => (
      <StatusDot
        domain="order"
        status={lookup(REPORT_ORDER_STATUS_TO_FE, row.status) ?? row.status}
      />
    ),
  },
  {
    key: "totalAmount",
    header: L.orders.total,
    align: "right",
    className: "min-w-32",
    cell: (row) =>
      row.totalAmount != null ? (
        <span className={MONO}>{formatMoney(row.totalAmount, row.currency ?? "VND")}</span>
      ) : (
        DASH
      ),
  },
  {
    key: "placedAt",
    header: L.orders.placedAt,
    align: "right",
    cell: (row) =>
      row.placedAt ? <span className={MUTED}>{formatDate(row.placedAt)}</span> : DASH,
  },
];
