"use client";

import { useSyncExternalStore } from "react";

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

export function InventoryNoMovements() {
  return (
    <EmptyState
      title={INVENTORY_LABELS.noMovements}
      description={INVENTORY_LABELS.noMovementsDescription}
    />
  );
}
