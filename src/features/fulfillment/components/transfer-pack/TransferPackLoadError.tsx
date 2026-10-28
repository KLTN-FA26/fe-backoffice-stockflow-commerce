"use client";

import { UI_LABELS } from "@/constants";
import { classifyLoadError } from "@/lib/api/load-error";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

import type { LoadErrorKind } from "@/lib/api/load-error";

const { common, loadError, transferPack } = UI_LABELS;

const COPY: Record<LoadErrorKind, { title: string; description: string }> = {
  "not-found": { title: transferPack.notFoundTitle, description: transferPack.notFoundDescription },
  forbidden: { title: loadError.forbiddenTitle, description: transferPack.noAccessDescription },
  "no-read": { title: transferPack.noAccessTitle, description: transferPack.noAccessDescription },
  "invalid-data": {
    title: loadError.invalidDataTitle,
    description: loadError.invalidDataDescription,
  },
  network: { title: loadError.networkTitle, description: loadError.networkDescription },
  server: { title: loadError.serverTitle, description: loadError.serverDescription },
  permissions: { title: loadError.permissionsTitle, description: loadError.permissionsDescription },
};

/** Trạng thái lỗi của trạm đóng gói chuyển kho — 403 / 404 / 5xx / mất mạng tách riêng (§8); lối về lệnh nằm ở tiêu đề trang. */
export function TransferPackLoadError({
  error,
  kind: forcedKind,
  onRetry,
}: {
  /** `null` = không có dữ liệu → coi như không tìm thấy. */
  error: unknown;
  kind?: LoadErrorKind;
  onRetry?: () => void;
}) {
  const kind = forcedKind ?? (error ? classifyLoadError(error) : "not-found");
  const copy = COPY[kind];
  const canRetry =
    onRetry !== undefined && kind !== "not-found" && kind !== "forbidden" && kind !== "no-read";
  return (
    <EmptyState
      title={copy.title}
      description={copy.description}
      action={
        canRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {common.retry}
          </Button>
        ) : undefined
      }
    />
  );
}
