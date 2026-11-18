"use client";

import {
  ADMIN_ROUTES,
  QUOTE_PERMISSIONS,
  QUOTE_STATUS_BY_API,
  QUOTE_STATUS_LABELS,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { useQuote } from "@/features/quote/queries";
import { isExpired } from "@/features/quote/selectors";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Card } from "@/components/shared/Card";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO, QUOTE_COPY } from "./copy";
import { QuoteFeesTotals } from "./detail/QuoteFeesTotals";
import { QuoteHistory } from "./detail/QuoteHistory";
import { QuoteNotices } from "./detail/QuoteNotices";
import { QuoteLinesTable } from "./detail/QuoteLinesTable";
import { QuoteStaffActions } from "./detail/QuoteStaffActions";

import type { ReactNode } from "react";
import type { Quote } from "@/features/quote/types";

function General({ quote }: { quote: Quote }) {
  const expired = quote.status === "SENT" && isExpired(quote.validUntil);
  const rows: [string, ReactNode][] = [
    [
      "Số báo giá",
      <span key="n" className={MONO}>
        {quote.quoteNumber}
      </span>,
    ],
    [
      "Bản sửa số",
      <span key="r" className={MONO}>
        {quote.revision}
      </span>,
    ],
    ["Khách hàng", <CustomerName key="c" id={quote.customerId} />],
    [
      "Hiệu lực đến",
      <span key="v" className={expired ? "text-danger" : undefined}>
        {formatDate(quote.validUntil)}
        {expired ? " — Hết hiệu lực" : ""}
      </span>,
    ],
    [
      "Ngày giao yêu cầu",
      quote.requestedDeliveryDate ? formatDate(quote.requestedDeliveryDate) : "—",
    ],
    ["Tạo lúc", formatDateTime(quote.createdAt)],
    ...(quote.sentAt ? [["Gửi khách", formatDateTime(quote.sentAt)] as [string, ReactNode]] : []),
    ...(quote.respondedAt
      ? [["Khách phản hồi", formatDateTime(quote.respondedAt)] as [string, ReactNode]]
      : []),
  ];
  return (
    <Card className="space-y-3">
      <h2 className="text-ink-primary text-sm font-semibold">Thông tin chung</h2>
      <dl className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-tertiary">{label}</dt>
            <dd className="text-ink-primary min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      {quote.terms && (
        <p className="text-ink-secondary border-border-default border-t pt-3 text-[0.8125rem] whitespace-pre-line">
          {quote.terms}
        </p>
      )}
    </Card>
  );
}

function QuoteDetailContent({ id }: { id: string }) {
  const canRead = useCan(QUOTE_PERMISSIONS.read);
  const query = useQuote(id, { enabled: canRead });
  useBreadcrumbLabel(id, query.data?.quoteNumber);
  const back = { href: ADMIN_ROUTES.quotes.list };
  if (!canRead) return <LoadErrorState error={null} kind="no-read" copy={QUOTE_COPY} back={back} />;
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={QUOTE_COPY}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.isPending) return <PageSkeleton variant="detail" />;
  const quote = query.data;

  return (
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">Báo giá {quote.quoteNumber}</h1>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <QuoteNotices quote={quote} />
          <General quote={quote} />
          <QuoteLinesTable lines={quote.lines} />
          <QuoteFeesTotals quote={quote} />
        </div>
        <div className="space-y-5">
          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-ink-primary text-sm font-semibold">Trạng thái</h2>
              <StatusDot
                domain="order"
                status={QUOTE_STATUS_BY_API[quote.status]}
                label={QUOTE_STATUS_LABELS[quote.status]}
              />
            </div>
            <QuoteStaffActions quote={quote} />
          </Card>
          <QuoteHistory history={quote.history} />
        </div>
      </div>
    </div>
  );
}

export function QuoteDetail({ id }: { id: string }) {
  return (
    <PermissionBoundary permissions={[QUOTE_PERMISSIONS.viewPage]}>
      <QuoteDetailContent id={id} />
    </PermissionBoundary>
  );
}
