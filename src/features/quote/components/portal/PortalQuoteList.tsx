"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";

import {
  PAGE_SIZE,
  PAYMENT_TERM_LABELS,
  PORTAL_ROUTES,
  QUOTE_PERMISSIONS,
  QUOTE_STATUS_BY_API,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { formatDate } from "@/lib/format/date";
import { useQuotes } from "@/features/quote/queries";
import { isExpired } from "@/features/quote/selectors";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { MONO, QUOTE_COPY } from "../copy";

/** Portal: báo giá của chính khách (BE tự giới hạn theo khách + trạng thái khách được thấy). */
export function PortalQuoteList() {
  const canRead = useCan(QUOTE_PERMISSIONS.read);
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const query = useQuotes(
    { page: Math.max(0, page - 1), size: PAGE_SIZE.sm, sort: "createdAt,desc" },
    { enabled: canRead },
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Báo giá</h1>
        <p className="text-ink-secondary">Báo giá bộ phận bán hàng gửi cho doanh nghiệp bạn.</p>
      </div>
      {!canRead ? (
        <LoadErrorState inline error={null} kind="no-read" copy={QUOTE_COPY} />
      ) : query.isError ? (
        <LoadErrorState
          inline
          error={query.error}
          copy={QUOTE_COPY}
          onRetry={() => void query.refetch()}
        />
      ) : query.isPending ? (
        <PageSkeleton variant="list" />
      ) : query.data.totalElements === 0 ? (
        <EmptyState
          icon={<FileText className="size-8" />}
          title="Chưa có báo giá"
          description="Khi bộ phận bán hàng gửi báo giá, bạn sẽ thấy ở đây."
        />
      ) : (
        <>
          <ul className="space-y-3">
            {query.data.items.map((row) => (
              <li key={row.id}>
                <Link
                  href={PORTAL_ROUTES.quotes.detail(row.id)}
                  className="bg-bg-surface border-border-default focus-visible:ring-brand flex min-h-11 flex-wrap items-center gap-x-6 gap-y-2 rounded-[var(--r-lg)] border p-5 shadow-[var(--sh-md)] focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className={`text-ink-primary font-semibold ${MONO}`}>
                    {row.quoteNumber}
                  </span>
                  <StatusDot domain="order" status={QUOTE_STATUS_BY_API[row.status]} />
                  <span className="text-ink-secondary text-sm">
                    {PAYMENT_TERM_LABELS[row.paymentTerm]}
                  </span>
                  <span
                    className={`text-sm tabular-nums ${row.status === "SENT" && isExpired(row.validUntil) ? "text-danger" : "text-ink-secondary"}`}
                  >
                    Hiệu lực đến {formatDate(row.validUntil)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <nav aria-label="Phân trang báo giá" className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              className="min-h-11"
              disabled={!query.data.hasPrevious}
              onClick={() => void setPage(page - 1)}
            >
              Trang trước
            </Button>
            <span className="text-ink-secondary text-sm tabular-nums">
              Trang {query.data.page + 1} / {Math.max(1, query.data.totalPages)}
            </span>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={!query.data.hasNext}
              onClick={() => void setPage(page + 1)}
            >
              Trang sau
            </Button>
          </nav>
        </>
      )}
    </div>
  );
}
