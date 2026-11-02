"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PORTAL_ROUTES, SAMPLE_REQUEST_PERMISSIONS, SAMPLE_STATUS_BY_API } from "@/constants";

import { useCan, usePermissionChecker } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format/date";

import { sampleErrorMessage } from "@/features/sample-request/errors";
import { allowedPortalSampleActions } from "@/features/sample-request/lifecycle";
import { useApproveSample, useRequestSampleChanges } from "@/features/sample-request/mutations";
import { useSample } from "@/features/sample-request/queries";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { MONO, SAMPLE_COPY } from "../copy";

/** Portal: khách duyệt mẫu hoặc yêu cầu sửa (chỉ khi mẫu đã được gửi). */
export function PortalSampleDetail({ id }: { id: string }) {
  const canRead = useCan(SAMPLE_REQUEST_PERMISSIONS.read);
  const can = usePermissionChecker();
  const query = useSample(id, { enabled: canRead });
  const [dialog, setDialog] = useState<"approve" | "changes" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const approve = useApproveSample();
  const changes = useRequestSampleChanges();
  const back = { href: PORTAL_ROUTES.samples.list, label: "Về danh sách mẫu" };
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
  const actions = allowedPortalSampleActions(sample.status, can);
  const onError = (failure: unknown) => {
    setDialog(null);
    setError(sampleErrorMessage(failure));
  };

  return (
    <div className="space-y-6">
      <Link
        href={PORTAL_ROUTES.samples.list}
        className="text-ink-secondary inline-flex min-h-11 items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Mẫu thử
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className={`text-2xl font-bold ${MONO}`}>{sample.requestNumber}</h1>
        <StatusDot domain="design" status={SAMPLE_STATUS_BY_API[sample.status]} size="md" />
      </div>
      <dl className="bg-bg-surface border-border-default grid gap-x-6 gap-y-3 rounded-[var(--r-lg)] border p-6 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-tertiary">Lần mẫu</dt>
          <dd>{sample.round}</dd>
        </div>
        <div>
          <dt className="text-ink-tertiary">Phôi</dt>
          <dd className={MONO}>{sample.specification.blankSku}</dd>
        </div>
        <div>
          <dt className="text-ink-tertiary">Số lượng</dt>
          <dd className="tabular-nums">{sample.specification.quantity} cái</dd>
        </div>
        <div>
          <dt className="text-ink-tertiary">Cần trước</dt>
          <dd>{sample.specification.dueDate ? formatDate(sample.specification.dueDate) : "—"}</dd>
        </div>
        {sample.sentAt && (
          <div>
            <dt className="text-ink-tertiary">Đã gửi cho bạn</dt>
            <dd>{formatDateTime(sample.sentAt)}</dd>
          </div>
        )}
        {sample.customerFeedback && (
          <div className="sm:col-span-2">
            <dt className="text-ink-tertiary">Góp ý đã gửi</dt>
            <dd className="whitespace-pre-line">{sample.customerFeedback}</dd>
          </div>
        )}
      </dl>
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="min-h-11" onClick={() => setDialog("changes")}>
            Yêu cầu sửa mẫu
          </Button>
          <Button className="min-h-11" onClick={() => setDialog("approve")}>
            Duyệt mẫu
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={dialog === "approve"}
        onOpenChange={(value) => !value && setDialog(null)}
        title="Duyệt mẫu in này?"
        description="Mẫu được duyệt là chuẩn để kiểm tra chất lượng khi sản xuất hàng loạt."
        confirmLabel="Duyệt mẫu"
        variant="default"
        loading={approve.isPending}
        closeOnConfirm={false}
        onConfirm={() => approve.mutate(sample.id, { onSuccess: () => setDialog(null), onError })}
      />
      <ConfirmDialog
        open={dialog === "changes"}
        onOpenChange={(value) => !value && setDialog(null)}
        title="Yêu cầu sửa mẫu"
        description="Mô tả cụ thể điểm cần sửa (màu, vị trí in, kích thước…)."
        confirmLabel="Gửi yêu cầu"
        variant="default"
        requireReason
        reasonLabel="Nội dung cần sửa"
        reasonMaxLength={2000}
        loading={changes.isPending}
        closeOnConfirm={false}
        onConfirm={(reason) =>
          changes.mutate(
            { id: sample.id, feedback: reason ?? "" },
            { onSuccess: () => setDialog(null), onError },
          )
        }
      />
    </div>
  );
}
