"use client";

import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

const { common, loadError, inventoryItem } = UI_LABELS;

/** `no-read` = có VIEW_PAGE nhưng thiếu READ; `error` = lỗi tải (404 → không tìm thấy). */
export function ItemDetailError({
  kind,
  error,
  onRetry,
}: {
  kind: "no-read" | "error";
  error?: unknown;
  onRetry?: () => void;
}) {
  const notFound = kind === "error" && error instanceof ApiError && error.status === 404;
  const title =
    kind === "no-read"
      ? loadError.noReadTitle
      : notFound
        ? inventoryItem.notFound
        : loadError.serverTitle;
  const description = kind === "error" && !notFound ? loadError.networkDescription : undefined;
  const canRetry = kind === "error" && !notFound && onRetry !== undefined;

  return (
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{inventoryItem.title}</h1>
      <EmptyState
        title={title}
        description={description}
        action={
          <div className="flex items-center gap-2">
            {canRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                {common.retry}
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={ADMIN_ROUTES.inventoryItems.list}>{common.backToList}</Link>
            </Button>
          </div>
        }
      />
      {error instanceof ApiError && error.traceId && (
        <p className="text-ink-tertiary mt-2 text-center text-xs">
          {common.traceId}:{" "}
          <span className="font-[family-name:var(--font-mono)]">{error.traceId}</span>
        </p>
      )}
    </div>
  );
}
