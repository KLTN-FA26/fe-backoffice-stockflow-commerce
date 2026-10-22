"use client";

import { Download } from "lucide-react";

import { safeHttpUrl } from "@/lib/api/signed-url";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { printFileErrorMessage } from "@/features/production-order/errors";
import { usePrintFile } from "@/features/production-order/queries";
import { SignedFilePreview } from "@/components/backoffice/SignedFilePreview";
import { Card } from "@/components/shared/Card";
import { Notice } from "@/components/shared/Notice";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import { MONO } from "../copy";

import type { ProductionDetail } from "@/features/production-order/types";

/**
 * File in PRINT_READY khoá theo thiết kế (SCRUM-408): xem trước tại chỗ + mở/tải qua link ký ngắn hạn
 * của BE. BE đối chiếu checksum trước khi cấp link và lại lần nữa khi duyệt prepress (BR-PRD-02).
 */
export function PrintFileCard({ order }: { order: ProductionDetail }) {
  const file = usePrintFile(order.summary.id);
  const url = file.data ? safeHttpUrl(file.data.url) : null;
  return (
    <Card className="space-y-3">
      <h2 className="text-ink-primary text-sm font-semibold">File in</h2>
      {file.isPending && <Skeleton className="h-72" />}
      {file.isError && (
        <Notice tone="warning" live>
          {printFileErrorMessage(file.error)}{" "}
          <button type="button" className="underline" onClick={() => void file.refetch()}>
            Thử lại
          </button>
        </Notice>
      )}
      {file.data && (
        <>
          <SignedFilePreview
            url={file.data.url}
            contentType={file.data.contentType}
            alt={`File in của ${order.summary.orderNumber}`}
            onRefresh={() => void file.refetch()}
          />
          <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
            <dt className="text-ink-tertiary">Tên file</dt>
            <dd className="break-all">{file.data.originalName}</dd>
            <dt className="text-ink-tertiary">Định dạng</dt>
            <dd className={MONO}>{file.data.contentType}</dd>
            <dt className="text-ink-tertiary">Dung lượng</dt>
            <dd className={MONO}>{formatNumber(Math.ceil(file.data.sizeBytes / 1024))} KB</dd>
            <dt className="text-ink-tertiary">Checksum</dt>
            <dd className={`${MONO} break-all`}>{file.data.checksum}</dd>
            <dt className="text-ink-tertiary">Link hết hạn</dt>
            <dd>{formatDateTime(file.data.expiresAt)}</dd>
          </dl>
          {url && (
            <Button asChild size="sm" variant="outline">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Download className="size-3.5" /> Mở / tải file in
              </a>
            </Button>
          )}
        </>
      )}
      {order.prepressCheckedAt && (
        <p className="text-ink-secondary text-[0.8125rem]">
          Prepress đạt lúc {formatDateTime(order.prepressCheckedAt)}.
        </p>
      )}
    </Card>
  );
}
