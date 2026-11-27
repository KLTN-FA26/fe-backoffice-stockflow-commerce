"use client";

import Link from "next/link";
import { CalendarX2 } from "lucide-react";

import { ADMIN_ROUTES, QUOTE_API_STATUSES, QUOTE_STATUS_LABELS } from "@/constants";

import { formatMoney } from "@/lib/format";
import { formatDate, formatDateTime } from "@/lib/format/date";

import { isExpired } from "@/features/quote/selectors";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO, QUOTE_LIST_LABELS as L, QUOTE_STATUS_TONE_KEY, quoteStatusLabel } from "./copy";
import { PriceReviewBadge } from "./price-review/PriceReviewBadge";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { QuoteRow } from "@/features/quote/types";

export const STATUS_OPTIONS = QUOTE_API_STATUSES.map((value) => ({
  value,
  label: quoteStatusLabel(value),
}));

export const SORTABLE = new Set(["quoteNumber", "status", "validUntil", "createdAt"]);

export const QUOTE_COLUMNS = [
  "quoteNumber",
  "customer",
  "status",
  "total",
  "validUntil",
  "sentAt",
  "order",
  "actions",
] as const;
export type QuoteColumn = (typeof QUOTE_COLUMNS)[number];
export const QUOTE_LOCKED_COLUMNS: readonly QuoteColumn[] = ["quoteNumber", "actions"];
export const QUOTE_COLUMN_LABELS: Record<QuoteColumn, string> = {
  quoteNumber: L.number,
  customer: L.customer,
  status: L.status,
  total: L.total,
  validUntil: L.validUntil,
  sentAt: L.sentAt,
  order: L.order,
  actions: "Thao tác",
};

/** Báo giá đã gửi mà quá hạn hiệu lực (job chưa kịp chuyển EXPIRED): khách không còn chấp nhận được. */
export const sentButExpired = (row: Pick<QuoteRow, "status" | "validUntil">) =>
  row.status === "SENT" && isExpired(row.validUntil);

/**
 * Trạng thái; báo giá đã gửi mà quá hạn hiệu lực ghi rõ "Hết hiệu lực" bằng chữ (BO-UX-13, WCAG 1.4.1 — không chỉ đổi
 * màu ngày) như trang chi tiết; nháp chờ duyệt giá ghi "Chờ duyệt giá" (14 BR-10).
 */
function QuoteStatusCell({ row }: { row: QuoteRow }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <StatusDot
        domain="order"
        status={QUOTE_STATUS_TONE_KEY[row.status]}
        label={QUOTE_STATUS_LABELS[row.status]}
      />
      {row.status === "DRAFT" && row.priceReviewPending && <PriceReviewBadge />}
      {sentButExpired(row) && (
        <span className="text-ink-primary inline-flex items-center gap-1 text-xs font-medium">
          <CalendarX2 className="text-dot-danger size-3.5" aria-hidden="true" />
          {L.expired}
        </span>
      )}
    </span>
  );
}

/** Số báo giá kèm bản (BO-UX-12: "QT-0012 · b2" thay cột "Bản") và, khi BE trả (R5-2), mặt hàng đầu + số dòng. */
function QuoteNumberCell({ row }: { row: QuoteRow }) {
  const more = row.lineCount != null && row.lineCount > 1 ? row.lineCount - 1 : 0;
  return (
    <div className="flex min-w-0 flex-col">
      <Link
        href={ADMIN_ROUTES.quotes.detail(row.id)}
        className={`text-accent-text font-medium hover:underline ${MONO}`}
        onClick={(event) => event.stopPropagation()}
      >
        {row.quoteNumber}
        {row.revision > 1 && (
          <span className="text-ink-secondary font-normal"> · {L.revision(row.revision)}</span>
        )}
      </Link>
      {row.firstItemName && (
        <span className="text-ink-tertiary max-w-56 truncate text-xs" title={row.firstItemName}>
          {row.firstItemName}
          {more > 0 && ` ${L.moreLines(more)}`}
        </span>
      )}
    </div>
  );
}

/**
 * Cột danh sách báo giá. "Tổng có thuế" (R5-2 `total`) chỉ có khi BE trả số cho ít nhất một dòng của trang — BE chưa có
 * trường này thì cột không hiện, thay vì một cột toàn "—".
 */
export function buildQuoteColumns(showTotal: boolean): ColumnDef<QuoteRow>[] {
  const columns: ColumnDef<QuoteRow>[] = [
    {
      key: "quoteNumber",
      header: L.number,
      sortable: true,
      cell: (row) => <QuoteNumberCell row={row} />,
    },
    { key: "customer", header: L.customer, cell: (row) => <CustomerName id={row.customerId} /> },
    {
      key: "status",
      header: L.status,
      sortable: true,
      cell: (row) => <QuoteStatusCell row={row} />,
    },
    {
      key: "total",
      header: L.total,
      align: "right",
      cell: (row) =>
        row.total != null ? (
          <span className={`text-ink-primary font-medium ${MONO}`}>{formatMoney(row.total)}</span>
        ) : (
          <span className="text-ink-tertiary text-xs">{L.notPriced}</span>
        ),
    },
    {
      key: "validUntil",
      header: L.validUntil,
      sortable: true,
      align: "right",
      cell: (row) => (
        <span className="text-ink-secondary tabular-nums">{formatDate(row.validUntil)}</span>
      ),
    },
    {
      key: "sentAt",
      header: L.sentAt,
      align: "right",
      cell: (row) => (
        <span className="text-ink-secondary tabular-nums">
          {row.sentAt ? formatDateTime(row.sentAt) : "—"}
        </span>
      ),
    },
    {
      key: "order",
      header: L.order,
      cell: (row) =>
        row.convertedOrderId ? (
          <Link
            href={ADMIN_ROUTES.orders.detail(row.convertedOrderId)}
            className="text-accent-text hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {L.openOrder}
          </Link>
        ) : (
          <span className="text-ink-tertiary">—</span>
        ),
    },
  ];
  return showTotal ? columns : columns.filter((column) => column.key !== "total");
}
