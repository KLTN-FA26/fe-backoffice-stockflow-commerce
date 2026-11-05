"use client";

import Link from "next/link";
import { parseAsInteger, useQueryState } from "nuqs";
import { FlaskConical } from "lucide-react";

import { PORTAL_ROUTES, SAMPLE_REQUEST_PERMISSIONS, SAMPLE_STATUS_BY_API } from "@/constants";

import { useCan } from "@/lib/auth";

import { useSamples } from "@/features/sample-request/queries";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { MONO, SAMPLE_COPY } from "../copy";

/** Portal: mẫu in của chính khách (BE giới hạn theo khách; vòng nháp không hiển thị). */
export function PortalSampleList() {
  const canRead = useCan(SAMPLE_REQUEST_PERMISSIONS.read);
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const query = useSamples(
    { page: Math.max(0, page - 1), size: 10, sort: "createdAt,desc" },
    { enabled: canRead },
  );
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Mẫu thử</h1>
        <p className="text-ink-secondary">Duyệt mẫu in trước khi sản xuất hàng loạt.</p>
      </div>
      {!canRead ? (
        <LoadErrorState inline error={null} kind="no-read" copy={SAMPLE_COPY} />
      ) : query.isError ? (
        <LoadErrorState
          inline
          error={query.error}
          copy={SAMPLE_COPY}
          onRetry={() => void query.refetch()}
        />
      ) : query.isPending ? (
        <PageSkeleton variant="list" />
      ) : query.data.totalElements === 0 ? (
        <EmptyState
          icon={<FlaskConical className="size-8" />}
          title="Chưa có mẫu"
          description="Khi có mẫu in cần bạn duyệt, mẫu sẽ hiện ở đây."
        />
      ) : (
        <>
          <ul className="space-y-3">
            {query.data.items.map((row) => (
              <li key={row.id}>
                <Link
                  href={PORTAL_ROUTES.samples.detail(row.id)}
                  className="bg-bg-surface border-border-default focus-visible:ring-brand flex min-h-11 flex-wrap items-center gap-x-6 gap-y-2 rounded-[var(--r-lg)] border p-5 shadow-[var(--sh-md)] focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className={`font-semibold ${MONO}`}>{row.requestNumber}</span>
                  <span className="text-ink-secondary text-sm">Lần {row.round}</span>
                  <StatusDot domain="design" status={SAMPLE_STATUS_BY_API[row.status]} />
                  <span className={`text-ink-secondary text-sm ${MONO}`}>
                    {row.blankSku} · {row.quantity} cái
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <nav aria-label="Phân trang mẫu" className="flex items-center justify-between gap-2">
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
