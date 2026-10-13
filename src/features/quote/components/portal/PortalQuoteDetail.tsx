"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  PAYMENT_TERM_LABELS,
  PORTAL_ROUTES,
  QUOTE_PERMISSIONS,
  QUOTE_STATUS_BY_API,
} from "@/constants";
import { useCan, usePermissionChecker } from "@/lib/auth";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { allowedPortalQuoteActions } from "@/features/quote/lifecycle";
import { useQuote } from "@/features/quote/queries";
import { displayTotal, linesNeedingSample } from "@/features/quote/selectors";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO, QUOTE_COPY } from "../copy";
import { QuoteLinesTable } from "../detail/QuoteLinesTable";
import { PortalQuoteResponse } from "./PortalQuoteResponse";

/** Portal khách: xem báo giá, chấp nhận hoặc yêu cầu chỉnh sửa (SCRUM-449). */
export function PortalQuoteDetail({ id }: { id: string }) {
  const canRead = useCan(QUOTE_PERMISSIONS.read);
  const can = usePermissionChecker();
  const query = useQuote(id, { enabled: canRead });
  const [now] = useState(() => Date.now());
  const back = { href: PORTAL_ROUTES.quotes.list, label: "Về danh sách báo giá" };
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
  const actions = allowedPortalQuoteActions(quote.status, quote.validUntil, can, now);
  const needSample = linesNeedingSample(quote);
  const total = displayTotal(quote);

  return (
    <div className="space-y-6">
      <Link
        href={PORTAL_ROUTES.quotes.list}
        className="text-ink-secondary inline-flex min-h-11 items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Báo giá
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className={`text-2xl font-bold ${MONO}`}>{quote.quoteNumber}</h1>
        <StatusDot domain="order" status={QUOTE_STATUS_BY_API[quote.status]} size="md" />
      </div>
      <dl className="bg-bg-surface border-border-default grid gap-x-6 gap-y-2 rounded-[var(--r-lg)] border p-6 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-tertiary">Thanh toán</dt>
          <dd>
            {PAYMENT_TERM_LABELS[quote.paymentTerm]}
            {quote.depositPercent != null ? ` — cọc ${quote.depositPercent}%` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-ink-tertiary">Hiệu lực đến</dt>
          <dd className="tabular-nums">{formatDate(quote.validUntil)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-ink-tertiary">
            {quote.acceptedTotal != null ? "Tổng đã chấp nhận" : "Tổng theo báo giá"}
          </dt>
          <dd className="font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums">
            {total != null ? formatMoney(total, "VND") : "—"}
          </dd>
        </div>
        {quote.terms && (
          <div className="sm:col-span-2">
            <dt className="text-ink-tertiary">Điều khoản</dt>
            <dd className="whitespace-pre-line">{quote.terms}</dd>
          </div>
        )}
      </dl>
      {needSample.length > 0 && quote.status === "SENT" && (
        <div
          role="status"
          className="border-warning/40 bg-warning/5 rounded-[var(--r-lg)] border p-4 text-sm"
        >
          <p className="font-semibold">Cần duyệt mẫu in trước khi chấp nhận</p>
          <p className="text-ink-secondary mt-1">
            {needSample.length} dòng dùng thiết kế mới chưa có mẫu được duyệt.{" "}
            <Link href={PORTAL_ROUTES.samples.list} className="text-brand underline">
              Xem mẫu thử
            </Link>
          </p>
        </div>
      )}
      <QuoteLinesTable lines={quote.lines} />
      {actions.length > 0 && (
        <PortalQuoteResponse quote={quote} sampleBlocked={needSample.length > 0} />
      )}
      {quote.status === "CHANGES_REQUESTED" && quote.customerFeedback && (
        <p className="text-ink-secondary text-sm">
          Bạn đã gửi yêu cầu chỉnh sửa: “{quote.customerFeedback}”. Sales sẽ gửi bản mới.
        </p>
      )}
    </div>
  );
}
