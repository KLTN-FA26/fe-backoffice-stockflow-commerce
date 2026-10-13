"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  ADMIN_ROUTES,
  PAYMENT_TERM_LABELS,
  QUOTE_PERMISSIONS,
  QUOTE_STATUS_BY_API,
  SAMPLE_REQUEST_PERMISSIONS,
} from "@/constants";
import { useCan, usePermissionChecker } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { TERMINAL_QUOTE_STATUSES } from "@/features/quote/lifecycle";
import { useQuote } from "@/features/quote/queries";
import { displayTotal, linesNeedingSample } from "@/features/quote/selectors";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Card } from "@/components/shared/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/shared/Notice";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO, QUOTE_COPY } from "./copy";
import { QuoteHistory } from "./detail/QuoteHistory";
import { QuoteLinesTable, SampleRequestLink } from "./detail/QuoteLinesTable";
import { QuoteStaffActions } from "./detail/QuoteStaffActions";

import type { Quote } from "@/features/quote/types";

function Summary({ quote }: { quote: Quote }) {
  const total = displayTotal(quote);
  const rows: [string, React.ReactNode][] = [
    ["Khách hàng", <CustomerName key="c" id={quote.customerId} />],
    ["Thanh toán", PAYMENT_TERM_LABELS[quote.paymentTerm]],
    ...(quote.depositPercent != null
      ? [
          [
            "Tỷ lệ cọc",
            <span key="d" className="tabular-nums">
              {quote.depositPercent}%
            </span>,
          ] as [string, React.ReactNode],
        ]
      : []),
    ["Hiệu lực đến", formatDate(quote.validUntil)],
    ...(quote.sentAt
      ? [["Gửi khách", formatDateTime(quote.sentAt)] as [string, React.ReactNode]]
      : []),
    ...(quote.respondedAt
      ? [["Khách phản hồi", formatDateTime(quote.respondedAt)] as [string, React.ReactNode]]
      : []),
    [
      quote.acceptedTotal != null ? "Tổng đã chấp nhận" : "Tổng đề xuất",
      total != null ? (
        <span key="t" className={`font-semibold ${MONO}`}>
          {formatMoney(total, "VND")}
        </span>
      ) : (
        "Chưa đủ giá các dòng"
      ),
    ],
  ];
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-ink-primary text-sm font-semibold">Tổng quan</h2>
        <StatusDot domain="order" status={QUOTE_STATUS_BY_API[quote.status]} />
      </div>
      <dl className="grid grid-cols-[minmax(120px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
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
  const can = usePermissionChecker();
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
  const open = !TERMINAL_QUOTE_STATUSES.includes(quote.status) && quote.status !== "ACCEPTED";
  const canRequestSample = open && can(SAMPLE_REQUEST_PERMISSIONS.create);
  const pendingSamples = linesNeedingSample(quote).length;

  return (
    <>
      <PageHeader
        title={`Báo giá ${quote.quoteNumber}`}
        subtitle={`Bản ${quote.revision} · tạo ${formatDateTime(quote.createdAt)}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={ADMIN_ROUTES.quotes.list}>
                <ArrowLeft className="size-3.5" /> Danh sách
              </Link>
            </Button>
            <QuoteStaffActions quote={quote} />
          </>
        }
      />
      <div className="space-y-4">
        {quote.status === "CHANGES_REQUESTED" && quote.customerFeedback && (
          <div
            role="status"
            className="border-warning/40 bg-warning/5 rounded-[var(--r-sm)] border px-4 py-3 text-[0.8125rem]"
          >
            <div className="text-ink-primary font-semibold">Khách yêu cầu chỉnh sửa</div>
            <p className="text-ink-secondary mt-1 whitespace-pre-line">{quote.customerFeedback}</p>
          </div>
        )}
        {quote.convertedOrder && (
          <div className="border-positive/40 bg-positive/5 flex flex-wrap items-center gap-3 rounded-[var(--r-sm)] border px-4 py-3 text-[0.8125rem]">
            <span className="text-ink-primary">
              Đã tạo đơn <span className={MONO}>{quote.convertedOrder.orderNumber}</span> —{" "}
              <span className={MONO}>{formatMoney(quote.convertedOrder.total, "VND")}</span>
            </span>
            <Link
              href={ADMIN_ROUTES.orders.detail(quote.convertedOrder.orderId)}
              className="text-accent hover:underline"
            >
              Mở đơn bán
            </Link>
          </div>
        )}
        {pendingSamples > 0 && open && (
          <Notice tone="warning">
            {pendingSamples} dòng dùng thiết kế mới chưa có mẫu được duyệt — khách chỉ chấp nhận
            được sau khi duyệt mẫu (BR-PRD-08).
          </Notice>
        )}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Summary quote={quote} />
          <QuoteHistory history={quote.history} />
        </div>
        <QuoteLinesTable
          lines={quote.lines}
          sampleAction={(line) =>
            canRequestSample && !line.sample.satisfied ? (
              <SampleRequestLink
                href={ADMIN_ROUTES.sampleRequests.createFromQuoteLine({
                  quoteId: quote.id,
                  customerId: quote.customerId,
                  blankSku: line.blankSku,
                  designSnapshotId: line.designSnapshotId,
                })}
              />
            ) : null
          }
        />
      </div>
    </>
  );
}

export function QuoteDetail({ id }: { id: string }) {
  return (
    <PermissionBoundary permissions={[QUOTE_PERMISSIONS.viewPage]}>
      <QuoteDetailContent id={id} />
    </PermissionBoundary>
  );
}
