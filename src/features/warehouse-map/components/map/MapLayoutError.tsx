"use client";

import { MapPin } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { classifyLoadError } from "@/lib/api/load-error";

import { warehouseMapErrorMessage } from "@/features/warehouse-map/errors";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

const M = UI_LABELS.warehouseMap.map;
const LE = UI_LABELS.loadError;

/** Lỗi tải bản đồ: mất mạng / sai hợp đồng / 403 / 404 / 5xx hiện đúng câu, có nút thử lại (§8). */
export function MapLayoutError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const kind = classifyLoadError(error);
  const description =
    kind === "network"
      ? LE.networkDescription
      : kind === "invalid-data"
        ? LE.invalidDataDescription
        : kind === "forbidden"
          ? M.noReadDescription
          : kind === "server"
            ? LE.serverDescription
            : warehouseMapErrorMessage(error);
  return (
    <EmptyState
      icon={<MapPin className="size-8" />}
      title={M.loadFailedTitle}
      description={description}
      action={
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {UI_LABELS.common.retry}
        </Button>
      }
    />
  );
}
