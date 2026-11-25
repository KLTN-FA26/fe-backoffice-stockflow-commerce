"use client";

import { FileText, ScrollText } from "lucide-react";

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
import { DETAIL_CARD_CLASS, DetailSection, InfoRow } from "@/components/shared/DetailSection";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO, QUOTE_COPY } from "./copy";
import { QuoteFeesTotals } from "./detail/QuoteFeesTotals";
import { QuoteHistory } from "./detail/QuoteHistory";
import { QuoteNotices } from "./detail/QuoteNotices";
import { QuoteLinesTable } from "./detail/QuoteLinesTable";
import { QuoteNextStep } from "./detail/QuoteNextStep";
import { QuoteStaffActions } from "./detail/QuoteStaffActions";
import { PriceReviewBadge } from "./price-review/PriceReviewBadge";
import { PriceReviewNotice } from "./price-review/PriceReviewNotice";
import { QuotePriceReviewSection } from "./price-review/QuotePriceReviewSection";

import type { Quote } from "@/features/quote/types";

/** "Thông tin chung" — trang chi tiết không có tiêu đề, nên số báo giá là dòng đầu của mục này. */
function General({ quote }: { quote: Quote }) {
  const expired = quote.status === "SENT" && isExpired(quote.validUntil);
  return (
    <DetailSection title="Thông tin chung" icon={FileText}>
      <div className="divide-y divide-(--table-line)">
        <InfoRow label="Số báo giá">
          <span className={`text-accent-text font-medium ${MONO}`}>{quote.quoteNumber}</span>
        </InfoRow>
        <InfoRow label="Bản sửa số">
          <span className={MONO}>{quote.revision}</span>
        </InfoRow>
        <InfoRow label="Khách hàng">
          <CustomerName id={quote.customerId} />
        </InfoRow>
        <InfoRow label="Hiệu lực đến">
          <span className={expired ? "text-danger" : undefined}>
            {formatDate(quote.validUntil)}
            {expired ? " — Hết hiệu lực" : ""}
          </span>
        </InfoRow>
        <InfoRow label="Ngày giao yêu cầu">
          {quote.requestedDeliveryDate ? formatDate(quote.requestedDeliveryDate) : "—"}
        </InfoRow>
        <InfoRow label="Tạo lúc">{formatDateTime(quote.createdAt)}</InfoRow>
        {quote.sentAt && <InfoRow label="Gửi khách">{formatDateTime(quote.sentAt)}</InfoRow>}
        {quote.respondedAt && (
          <InfoRow label="Khách phản hồi">{formatDateTime(quote.respondedAt)}</InfoRow>
        )}
      </div>
    </DetailSection>
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
    // Giao diện kiểu Vercel như trang chi tiết sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề —
    // breadcrumb topbar đã có số báo giá; h1 giữ cho screen reader. Lưới tách hai cột từ `xl` (không như sản phẩm
    // từ `lg`) vì bảng dòng báo giá rộng ~960px.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">Báo giá {quote.quoteNumber}</h1>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <QuoteNotices quote={quote} />
          <PriceReviewNotice quote={quote} />
          <General quote={quote} />
          {quote.terms && (
            <DetailSection title="Điều khoản" icon={ScrollText}>
              <p className="text-ink-secondary text-[0.8125rem] leading-relaxed whitespace-pre-line">
                {quote.terms}
              </p>
            </DetailSection>
          )}
          <QuoteLinesTable lines={quote.lines} />
          <QuotePriceReviewSection quote={quote} />
          <QuoteFeesTotals quote={quote} />
        </div>
        <div className="space-y-5">
          {/* Trạng thái + hành động — cùng bố cục thẻ hành động trang chi tiết sản phẩm */}
          <section className={DETAIL_CARD_CLASS}>
            <div className="mb-4 flex flex-col items-center gap-1.5">
              <StatusDot
                domain="order"
                status={QUOTE_STATUS_BY_API[quote.status]}
                label={QUOTE_STATUS_LABELS[quote.status]}
                size="md"
              />
              {quote.status === "DRAFT" && quote.priceReviewPending && <PriceReviewBadge />}
            </div>
            <div className="space-y-3">
              <QuoteNextStep quote={quote} />
              <QuoteStaffActions quote={quote} />
            </div>
          </section>
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
