"use client";

import { apiErrorMessage } from "@/lib/api/error-message";
import { useSnapshotPreview } from "@/lib/references/design-lookup";
import { SignedFilePreview } from "@/components/backoffice/SignedFilePreview";
import { Skeleton } from "@/components/shared/Skeleton";

const PREVIEW_ERRORS: Readonly<Record<string, string>> = {
  NOT_FOUND: "Thiết kế này không thuộc khách đang chọn, hoặc chưa có ảnh khách xác nhận.",
  CONFLICT: "Ảnh của thiết kế không khớp checksum đã xác nhận — không hiển thị.",
};

/** Ảnh CUSTOMER_PREVIEW khách đã xác nhận cho snapshot đang chọn (link ngắn hạn của BE). */
export function DesignSnapshotPreview({
  snapshotId,
  customerId,
  name,
}: {
  snapshotId: string;
  customerId: string;
  name: string;
}) {
  const preview = useSnapshotPreview(snapshotId, customerId);
  if (preview.isPending) return <Skeleton className="size-32 shrink-0" />;
  if (preview.isError)
    return (
      <p role="alert" className="text-ink-tertiary w-32 shrink-0 text-xs">
        {apiErrorMessage(preview.error, PREVIEW_ERRORS)}
      </p>
    );
  return (
    <SignedFilePreview
      url={preview.data.url}
      contentType={preview.data.contentType}
      alt={`Thiết kế khách đã xác nhận: ${name}`}
      size="thumb"
      onRefresh={() => void preview.refetch()}
    />
  );
}
