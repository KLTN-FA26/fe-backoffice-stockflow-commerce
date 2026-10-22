"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  ADMIN_ROUTES,
  PRODUCTION_STATUS_BY_API,
  SAMPLE_REQUEST_PERMISSIONS,
  SAMPLE_STATUS_BY_API,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { useSample } from "@/features/sample-request/queries";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Card } from "@/components/shared/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { MONO, SAMPLE_COPY } from "./copy";
import { SampleActions } from "./detail/SampleActions";

import type { ReactNode } from "react";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-ink-tertiary">{label}</dt>
      <dd className="text-ink-primary min-w-0 break-words">{children}</dd>
    </div>
  );
}

function SampleDetailContent({ id }: { id: string }) {
  const canRead = useCan(SAMPLE_REQUEST_PERMISSIONS.read);
  const query = useSample(id, { enabled: canRead });
  useBreadcrumbLabel(id, query.data?.requestNumber);
  const back = { href: ADMIN_ROUTES.sampleRequests.list };
  if (!canRead)
    return <LoadErrorState error={null} kind="no-read" copy={SAMPLE_COPY} back={back} />;
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={SAMPLE_COPY}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.isPending) return <PageSkeleton variant="detail" />;
  const sample = query.data;
  const spec = sample.specification;

  return (
    <>
      <PageHeader
        title={`Yêu cầu mẫu ${sample.requestNumber}`}
        subtitle={`Lần ${sample.round} · tạo ${formatDateTime(sample.createdAt)}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={ADMIN_ROUTES.sampleRequests.list}>
                <ArrowLeft className="size-3.5" /> Danh sách
              </Link>
            </Button>
            <SampleActions sample={sample} />
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-ink-primary text-sm font-semibold">Quy cách mẫu</h2>
              <StatusDot domain="design" status={SAMPLE_STATUS_BY_API[sample.status]} />
            </div>
            <dl className="grid grid-cols-[minmax(120px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
              <Row label="Khách hàng">
                <CustomerName id={sample.customerId} />
              </Row>
              <Row label="Phôi">
                <span className={MONO}>{spec.blankSku}</span>
              </Row>
              <Row label="Thiết kế">
                <span className={MONO} title={spec.designSnapshotId}>
                  {spec.designSnapshotId.slice(0, 8)}
                </span>
              </Row>
              <Row label="Số lượng">
                <span className={MONO}>{formatNumber(spec.quantity)} cái</span>
              </Row>
              <Row label="Cần trước">{spec.dueDate ? formatDate(spec.dueDate) : "—"}</Row>
              {sample.quoteId && (
                <Row label="Báo giá">
                  <Link
                    href={ADMIN_ROUTES.quotes.detail(sample.quoteId)}
                    className="text-accent hover:underline"
                  >
                    Mở báo giá
                  </Link>
                </Row>
              )}
              {sample.productionOrder && (
                <Row label="LSX mẫu">
                  <Link
                    href={ADMIN_ROUTES.productionOrders.detail(sample.productionOrder.id)}
                    className={`text-accent hover:underline ${MONO}`}
                  >
                    {sample.productionOrder.orderNumber}
                  </Link>{" "}
                  <StatusDot
                    domain="order"
                    status={PRODUCTION_STATUS_BY_API[sample.productionOrder.status]}
                    className="ml-2"
                  />
                </Row>
              )}
              {sample.sentAt && <Row label="Gửi khách">{formatDateTime(sample.sentAt)}</Row>}
              {sample.respondedAt && (
                <Row label="Khách phản hồi">{formatDateTime(sample.respondedAt)}</Row>
              )}
            </dl>
            {sample.customerFeedback && (
              <p className="border-warning/40 bg-warning/5 rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem] whitespace-pre-line">
                Góp ý của khách: {sample.customerFeedback}
              </p>
            )}
            {sample.cancellationReason && (
              <p className="text-ink-secondary text-[0.8125rem]">
                Lý do huỷ: {sample.cancellationReason}
              </p>
            )}
          </Card>
        </div>
        <Card className="space-y-3">
          <h2 className="text-ink-primary text-sm font-semibold">Các lần mẫu</h2>
          <ol className="border-border-default space-y-3 border-l pl-4">
            {sample.rounds.map((round) => (
              <li key={round.id} className="text-[0.8125rem]">
                {round.id === sample.id ? (
                  <span className="text-ink-primary font-semibold">
                    Lần {round.round} (đang xem)
                  </span>
                ) : (
                  <Link
                    href={ADMIN_ROUTES.sampleRequests.detail(round.id)}
                    className="text-accent hover:underline"
                  >
                    Lần {round.round} — {round.requestNumber}
                  </Link>
                )}
                <div className="text-ink-secondary flex flex-wrap items-center gap-2">
                  <StatusDot domain="design" status={SAMPLE_STATUS_BY_API[round.status]} />
                  <span className={MONO}>{formatNumber(round.quantity)} cái</span>
                </div>
                {round.customerFeedback && (
                  <div className="text-ink-tertiary">“{round.customerFeedback}”</div>
                )}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}

export function SampleDetailView({ id }: { id: string }) {
  return (
    <PermissionBoundary permissions={[SAMPLE_REQUEST_PERMISSIONS.viewPage]}>
      <SampleDetailContent id={id} />
    </PermissionBoundary>
  );
}
