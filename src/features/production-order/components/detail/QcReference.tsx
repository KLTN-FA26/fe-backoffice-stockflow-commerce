"use client";

import { printFileErrorMessage } from "@/features/production-order/errors";
import { usePrintFile } from "@/features/production-order/queries";
import { SignedFilePreview } from "@/components/backoffice/SignedFilePreview";
import { Skeleton } from "@/components/shared/Skeleton";

import { ApprovedSampleReference } from "./ApprovedSampleReference";

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

const SUBCONTRACT_NOTE = (
  <p className="text-ink-tertiary text-xs">
    Hàng gia công trả về chỉ QC một lần tại đây; kho chỉ đếm và đối soát (quyết định 2026-10-13).
  </p>
);

/**
 * Chuẩn đối chiếu đặt cạnh form QC (SCRUM-418/419, BR-PRD-05): LSX mẫu so với file in đã khoá; LSX đơn so với
 * lần mẫu khách đã duyệt (ảnh khách duyệt qua `approved-sample`). Ảnh / link chỉ tải khi đang QC.
 */
export function Reference({
  order,
  canReadSample,
  withPreview,
}: {
  order: ProductionDetail;
  canReadSample: boolean;
  withPreview: boolean;
}) {
  const subcontracted = order.summary.mode === "SUBCONTRACTED" && SUBCONTRACT_NOTE;
  if (order.summary.type === "ORDER" && order.approvedSampleId && withPreview)
    return (
      <div className="space-y-1">
        <ApprovedSampleReference
          order={order}
          canReadSample={canReadSample}
          fallback={<LockedFileThumb order={order} />}
        />
        {subcontracted}
      </div>
    );
  let text = "Chuẩn đối chiếu: file in đã khoá.";
  if (order.summary.type === "ORDER")
    text = order.approvedSampleId
      ? "Chuẩn đối chiếu: lần mẫu khách đã duyệt (hiện khi lệnh tới bước QC)."
      : "Thiết kế in lại — không có mẫu mới; đối chiếu file in đã khoá.";
  return (
    <div className="flex flex-wrap items-start gap-3">
      {withPreview && <LockedFileThumb order={order} />}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-ink-secondary text-[0.8125rem]">{text}</p>
        {subcontracted}
      </div>
    </div>
  );
}
