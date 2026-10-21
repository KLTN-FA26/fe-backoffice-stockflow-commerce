"use client";

import { useSyncExternalStore } from "react";

import { UI_LABELS } from "@/constants";
import { INVENTORY_LABELS } from "@/constants/inventory";

import { Alert } from "@/components/shared/Alert";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

import { inventoryErrorView, isRetryableInventoryError } from "../errors";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function InventoryOffline() {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  return online ? null : (
    <div role="status">
      <Alert tone="warning">{INVENTORY_LABELS.offline}</Alert>
    </div>
  );
}

export function InventoryError({ error, retry }: { error: unknown; retry: () => void }) {
  const view = inventoryErrorView(error);
  return (
    <EmptyState
      title={view.title}
      description={view.detail}
      action={
        <div className="space-y-[var(--el-gap)]">
          {view.traceId && (
            <p>
              {INVENTORY_LABELS.trace}: {view.traceId}
            </p>
          )}
          {isRetryableInventoryError(view) && (
            <Button
              className="rounded-[var(--r-sm)]"
              type="button"
              onClick={retry}
              variant="outline"
            >
              {INVENTORY_LABELS.retry}
            </Button>
          )}
        </div>
      }
    />
  );
}

export function InventoryDenied() {
  return (
    <EmptyState title={INVENTORY_LABELS.denied} description={INVENTORY_LABELS.deniedDescription} />
  );
}

export function InventoryNoFilterResults({ reset }: { reset: () => void }) {
  return (
    <EmptyState
      title={INVENTORY_LABELS.noResults}
      description={INVENTORY_LABELS.noResultsDescription}
      action={
        <Button className="rounded-[var(--r-sm)]" type="button" variant="outline" onClick={reset}>
          {INVENTORY_LABELS.reset}
        </Button>
      }
    />
  );
}

/**
 * `?page` vượt số trang (link cũ, F5 sau khi xử lý phiếu cuối của trang cuối): BE trả `items: []`
 * nhưng `totalElements > 0` — khác "chưa có dữ liệu" và "lọc không ra" (api-conventions §8).
 */
export function InventoryInvalidPage({ toFirstPage }: { toFirstPage: () => void }) {
  const L = UI_LABELS.emptyList;
  return (
    <EmptyState
      title={L.invalidPageTitle}
      description={L.invalidPageDescription}
      action={
        <Button
          className="rounded-[var(--r-sm)]"
          type="button"
          variant="outline"
          onClick={toFirstPage}
        >
          {L.firstPage}
        </Button>
      }
    />
  );
}

export function InventoryNoMovements() {
  return (
    <EmptyState
      title={INVENTORY_LABELS.noMovements}
      description={INVENTORY_LABELS.noMovementsDescription}
    />
  );
}
