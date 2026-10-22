"use client";

import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { formatDateTime } from "@/lib/format/date";
import { productionErrorMessage } from "@/features/production-order/errors";
import { useApprovedSample } from "@/features/production-order/queries";
import { SignedFilePreview } from "@/components/backoffice/SignedFilePreview";
import { Notice } from "@/components/shared/Notice";
import { Skeleton } from "@/components/shared/Skeleton";

import { MONO } from "../copy";

import type { ReactNode } from "react";
import type { ProductionDetail } from "@/features/production-order/types";

/**
 * Lần mẫu khách đã duyệt mà LSX đơn được QC đối chiếu (SCRUM-418/419, BR-PRD-05): `GET …/approved-sample`
 * (BE PR #109) — BE tự suy ra lần mẫu qua chính LSX (không nhận id từ client) và đối chiếu checksum trước khi
 * cấp link ảnh. 409 = lần mẫu không còn là lần đã duyệt của lệnh → QC phải dừng lại, không đoán.
 */
export function ApprovedSampleReference({
  order,
  canReadSample,
  fallback,
}: {
  order: ProductionDetail;
  canReadSample: boolean;
  /** Hiện khi không có ảnh khách duyệt: file in đã khoá. */
  fallback: ReactNode;
}) {
  const sample = useApprovedSample(order.summary.id);
  if (sample.isPending) return <Skeleton className="h-32" />;
  if (sample.isError) {
    const code = sample.error instanceof ApiError ? sample.error.code : "";
    if (code === "NOT_FOUND")
      return (
        <div className="flex flex-wrap items-start gap-3">
          {fallback}
          <p className="text-ink-secondary min-w-0 flex-1 text-[0.8125rem]">
            Lệnh này không có lần mẫu được duyệt (thiết kế in lại) — đối chiếu file in đã khoá.
          </p>
        </div>
      );
    return (
      <Notice tone={code === "CONFLICT" ? "danger" : "warning"} live>
        {code === "CONFLICT"
          ? "Lần mẫu của lệnh không còn ở trạng thái đã duyệt hoặc đã đổi thiết kế — báo Sales trước khi QC."
          : productionErrorMessage(sample.error)}{" "}
        <button type="button" className="underline" onClick={() => void sample.refetch()}>
          Thử lại
        </button>
      </Notice>
    );
  }
  const s = sample.data;
  return (
    <div className="flex flex-wrap items-start gap-3">
      {s.preview ? (
        <SignedFilePreview
          url={s.preview.url}
          contentType={s.preview.contentType}
          alt={`Mẫu khách đã duyệt ${s.sampleRequestNumber} lần ${s.round}`}
          size="thumb"
          onRefresh={() => void sample.refetch()}
        />
      ) : (
        fallback
      )}
      <div className="text-ink-secondary min-w-0 flex-1 space-y-1 text-[0.8125rem]">
        <dl className="space-y-1">
          <div>
            <dt className="inline">Mẫu khách đã duyệt: </dt>
            <dd className="inline">
              {canReadSample ? (
                <Link
                  href={ADMIN_ROUTES.sampleRequests.detail(s.sampleRequestId)}
                  className={`text-accent hover:underline ${MONO}`}
                >
                  {s.sampleRequestNumber}
                </Link>
              ) : (
                <span className={MONO}>{s.sampleRequestNumber}</span>
              )}{" "}
              · lần {s.round}
              {s.approvedAt ? ` · duyệt ${formatDateTime(s.approvedAt)}` : ""}
            </dd>
          </div>
          {s.sampleProductionOrderId && s.sampleProductionOrderNumber && (
            <div>
              <dt className="inline">Mẫu vật in tại: </dt>
              <dd className="inline">
                <Link
                  href={ADMIN_ROUTES.productionOrders.detail(s.sampleProductionOrderId)}
                  className={`text-accent hover:underline ${MONO}`}
                >
                  {s.sampleProductionOrderNumber}
                </Link>
              </dd>
            </div>
          )}
        </dl>
        {!s.preview && (
          <p>Bộ thiết kế đã duyệt không có ảnh xem trước — so với mẫu vật và file in đã khoá.</p>
        )}
      </div>
    </div>
  );
}
