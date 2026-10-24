"use client";

import { ImageOff } from "lucide-react";

import { DESIGN_ARTIFACT_ROLE_LABELS, UI_LABELS } from "@/constants";
import { fulfillmentErrorMessage } from "@/features/fulfillment/errors";
import { useDesignArtifact } from "@/features/fulfillment/queries";
import { shortChecksum } from "@/features/fulfillment/selectors";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import { MONO } from "../primitives";
import { ArtifactButtons } from "./ArtifactButtons";

import type { DesignLineView } from "@/features/fulfillment/selectors";

const PREVIEW_ROLE = "CUSTOMER_PREVIEW";
const INTEGRITY = UI_LABELS.fulfillment.integrity;
const FRAME =
  "border-border-default bg-bg-subtle flex size-40 shrink-0 items-center justify-center overflow-hidden rounded-[var(--r-sm)] border";

function Preview({ taskId, lineId, alt }: { taskId: string; lineId: string; alt: string }) {
  const artifact = useDesignArtifact({ taskId, lineId, role: PREVIEW_ROLE }, true);
  if (artifact.isPending) return <Skeleton className="size-40 shrink-0" />;
  if (artifact.isError) {
    return (
      <div className={`${FRAME} text-ink-tertiary flex-col gap-1.5 p-3 text-center text-xs`}>
        <ImageOff className="size-5" />
        {fulfillmentErrorMessage(artifact.error, "artifact")}
        <Button
          type="button"
          variant="link"
          size="xs"
          className="h-auto p-0 align-baseline"
          onClick={() => void artifact.refetch()}
        >
          {UI_LABELS.common.retry}
        </Button>
      </div>
    );
  }
  if (!artifact.data.contentType.startsWith("image/")) {
    return (
      <div className={`${FRAME} text-ink-tertiary flex-col gap-1.5 p-3 text-center text-xs`}>
        <ImageOff className="size-5" />
        {DESIGN_ARTIFACT_ROLE_LABELS[PREVIEW_ROLE]} không phải ảnh — tải về để xem
      </div>
    );
  }
  return (
    <div className={FRAME}>
      {/* URL ký ngắn hạn của BE — không qua next/image (domain thay đổi theo kho lưu trữ). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={artifact.data.url} alt={alt} className="size-full object-contain" />
    </div>
  );
}

/**
 * Một dòng tuỳ chỉnh ở trạm đóng gói: bản xem trước thiết kế ĐÃ KHOÁ đặt cạnh thông tin dòng để
 * packer so với thành phẩm (docs 08 §4 bước 2, BR-02), kèm kết quả đối chiếu checksum gần nhất.
 */
export function DesignLineCard({
  taskId,
  line,
  index,
  canDownload,
}: {
  taskId: string;
  line: DesignLineView;
  index: number;
  canDownload: boolean;
}) {
  const evidence = line.latestEvidence;
  const name = line.sku ?? `Dòng ${index + 1}`;
  return (
    <article className="border-border-default bg-bg-surface flex flex-wrap gap-4 rounded-[var(--r-sm)] border p-3">
      {canDownload ? (
        <Preview taskId={taskId} lineId={line.lineId} alt={`Thiết kế đã khoá của ${name}`} />
      ) : (
        <div className={`${FRAME} text-ink-tertiary p-3 text-center text-xs`}>
          Bạn không có quyền xem file thiết kế của task này
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className={`text-ink-primary text-[0.9375rem] font-semibold ${MONO}`}>{name}</h3>
          {line.quantity !== undefined && (
            <span className="text-ink-secondary text-[0.8125rem]">
              SL <span className={MONO}>{line.quantity}</span>
            </span>
          )}
        </div>
        <dl className="text-[0.8125rem]">
          <div className="flex gap-2">
            <dt className="text-ink-tertiary">Checksum đã khoá</dt>
            <dd className={`text-ink-primary ${MONO}`} title={line.lockedChecksum}>
              {line.lockedChecksum ? `${shortChecksum(line.lockedChecksum)}…` : "—"}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-tertiary">Đối chiếu gần nhất</dt>
            <dd
              className={
                !evidence
                  ? "text-ink-tertiary"
                  : evidence.matching
                    ? "text-positive"
                    : "text-danger font-medium"
              }
            >
              {!evidence
                ? INTEGRITY.unverified
                : evidence.matching
                  ? INTEGRITY.match
                  : INTEGRITY.mismatch}
            </dd>
          </div>
        </dl>
        {canDownload && (
          <>
            <ArtifactButtons taskId={taskId} lineId={line.lineId} />
            <p className="text-ink-tertiary text-xs">{UI_LABELS.fulfillment.artifactDisclaimer}</p>
          </>
        )}
      </div>
    </article>
  );
}
