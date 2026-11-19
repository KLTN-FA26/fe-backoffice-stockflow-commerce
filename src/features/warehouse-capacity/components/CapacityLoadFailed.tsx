"use client";

import { Gauge } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { classifyLoadError } from "@/lib/api/load-error";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

const L = UI_LABELS.warehouseCapacity;
const LE = UI_LABELS.loadError;

/** Lỗi tải: mất mạng / sai hợp đồng / thiếu quyền / 5xx hiện đúng câu, có nút thử lại (api-conventions §8). */
export function CapacityLoadFailed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const kind = classifyLoadError(error);
  const description =
    kind === "network"
      ? LE.networkDescription
      : kind === "invalid-data"
        ? LE.invalidDataDescription
        : kind === "forbidden"
          ? L.forbiddenDescription
          : LE.serverDescription;
  return (
    <EmptyState
      icon={<Gauge className="size-8" />}
      title={L.loadFailedTitle}
      description={description}
      action={
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {UI_LABELS.common.retry}
        </Button>
      }
    />
  );
}
