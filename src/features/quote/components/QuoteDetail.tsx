"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ADMIN_ROUTES, QUOTE_PERMISSIONS, QUOTE_STATUS_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { useQuote } from "@/features/quote/queries";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { ObjectHeader } from "@/components/shared/ObjectPage";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { PageTabPanel, PageTabs } from "@/components/shared/PageTabs";

import { QUOTE_COPY, QUOTE_LIST_LABELS, QUOTE_STATUS_TONE_KEY } from "./copy";
import { QuoteFeesTotals } from "./detail/QuoteFeesTotals";
import { QuoteHistory } from "./detail/QuoteHistory";
import { QuoteLinesTable } from "./detail/QuoteLinesTable";
import { QuoteNotices } from "./detail/QuoteNotices";
import { QuoteOverviewPanel } from "./detail/QuoteOverviewPanel";
import { QuoteStaffActions } from "./detail/QuoteStaffActions";
import { PriceReviewBadge } from "./price-review/PriceReviewBadge";
import { PriceReviewNotice } from "./price-review/PriceReviewNotice";
import { QuotePriceReviewSection } from "./price-review/QuotePriceReviewSection";

const TABS = ["history"] as const;

function QuoteDetailContent({ id }: { id: string }) {
  const canRead = useCan(QUOTE_PERMISSIONS.read);
  const query = useQuote(id, { enabled: canRead });
  const [tab] = useQueryState("tab", parseAsStringLiteral(TABS).withDefault("history"));
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
    // Object page ERP (backoffice-erp-ui B10): header đối tượng (số báo giá, khách, trạng thái, nút chuyển trạng thái) →
    // cảnh báo → khung hồ sơ (vòng đời, thông số, điều khoản, việc tiếp theo) → dòng báo giá + duyệt giá + tổng hiện thẳng
    // (dữ liệu dùng nhiều nhất) → tab Lịch sử.
    <div className="surface-soft surface-compact">
      <ObjectHeader
        name={
          quote.revision > 1
            ? `${quote.quoteNumber} · ${QUOTE_LIST_LABELS.revision(quote.revision)}`
            : quote.quoteNumber
        }
        code={quote.id}
        codeLabel="ID báo giá"
        status={{
          tone: QUOTE_STATUS_TONE_KEY[quote.status],
          label: QUOTE_STATUS_LABELS[quote.status],
        }}
        meta={
          quote.status === "DRAFT" && quote.priceReviewPending ? <PriceReviewBadge /> : undefined
        }
        actions={<QuoteStaffActions quote={quote} />}
      />
      <div className="mb-5 space-y-3 empty:hidden">
        <QuoteNotices quote={quote} />
        <PriceReviewNotice quote={quote} />
      </div>
      <QuoteOverviewPanel quote={quote} />
      <div className="mb-6 space-y-5">
        <QuoteLinesTable lines={quote.lines} />
        <QuotePriceReviewSection quote={quote} />
        <QuoteFeesTotals quote={quote} />
      </div>
      <PageTabs
        tabs={[{ value: "history", label: "Lịch sử" }]}
        value={tab}
        onChange={() => undefined}
        idPrefix="quote-detail"
        ariaLabel="Thông tin báo giá"
      />
      <PageTabPanel idPrefix="quote-detail" value={tab}>
        <QuoteHistory history={quote.history} />
      </PageTabPanel>
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
