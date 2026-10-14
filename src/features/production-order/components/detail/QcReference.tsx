"use client";

import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { printFileErrorMessage } from "@/features/production-order/errors";
import { usePrintFile } from "@/features/production-order/queries";
import { SignedFilePreview } from "@/components/backoffice/SignedFilePreview";
import { Skeleton } from "@/components/shared/Skeleton";

import { MONO } from "../copy";

import type { ProductionDetail } from "@/features/production-order/types";

/** Bản thu nhỏ file in đã khoá — cùng query với thẻ File in nên không gọi BE thêm lần nữa. */
function LockedFileThumb({ order }: { order: ProductionDetail }) {
  const file = usePrintFile(order.summary.id);
  if (file.isPending) return <Skeleton className="size-32 shrink-0" />;
  if (file.isError)
    return (
      <p className="text-ink-tertiary w-32 shrink-0 text-xs">{printFileErrorMessage(file.error)}</p>
    );
  return (
    <SignedFilePreview
      url={file.data.url}
      contentType={file.data.contentType}
      alt={`Thiết kế đã khoá của ${order.summary.orderNumber}`}
      size="thumb"
      onRefresh={() => void file.refetch()}
    />
  );
}

function ReferenceText({
  order,
  canReadSample,
}: {
  order: ProductionDetail;
  canReadSample: boolean;
}) {
  // BR-PRD-05 (SCRUM-399): LSX mẫu đối chiếu file in; LSX đơn đối chiếu mẫu khách đã duyệt.
  if (order.summary.type === "SAMPLE") return <>Chuẩn đối chiếu: file in đã khoá.</>;
  if (!order.approvedSampleId)
    return <>Thiết kế in lại — không có mẫu mới; đối chiếu file in đã khoá.</>;
  return (
    <>
      Chuẩn đối chiếu: mẫu khách đã duyệt{" "}
      {canReadSample ? (
        <Link
          href={ADMIN_ROUTES.sampleRequests.detail(order.approvedSampleId)}
          className="text-accent hover:underline"
        >
          mở phiếu mẫu
        </Link>
      ) : (
        <span className={MONO}>{order.approvedSampleId.slice(0, 8)}</span>
      )}
      . Hệ thống chưa lưu ảnh của mẫu đã duyệt — so với mẫu vật và file in đã khoá.
    </>
  );
}

/** Chuẩn đối chiếu đặt cạnh form QC (SCRUM-419); bản thu nhỏ chỉ hiện khi đang QC. */
export function Reference({
  order,
  canReadSample,
  withPreview,
}: {
  order: ProductionDetail;
  canReadSample: boolean;
  withPreview: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      {withPreview && <LockedFileThumb order={order} />}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-ink-secondary text-[0.8125rem]">
          <ReferenceText order={order} canReadSample={canReadSample} />
        </p>
        {order.summary.mode === "SUBCONTRACTED" && (
          <p className="text-ink-tertiary text-xs">
            Hàng gia công trả về chỉ QC một lần tại đây; kho chỉ đếm và đối soát (quyết định
            2026-10-13).
          </p>
        )}
      </div>
    </div>
  );
}
