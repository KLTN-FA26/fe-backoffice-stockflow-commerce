"use client";

import { useSyncExternalStore } from "react";

import { INVENTORY_LABELS } from "@/constants/inventory";

import { ApiError } from "@/lib/api/error";

import { Alert } from "@/components/shared/Alert";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

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
  const denied = error instanceof ApiError && error.status === 403;
  return (
    <EmptyState
      title={denied ? INVENTORY_LABELS.denied : INVENTORY_LABELS.loadError}
      description={error instanceof Error ? error.message : INVENTORY_LABELS.loadError}
      action={
        <div className="space-y-[var(--el-gap)]">
          {error instanceof ApiError && error.traceId && (
            <p>
              {INVENTORY_LABELS.trace}: {error.traceId}
            </p>
          )}
          <Button className="rounded-[var(--r-sm)]" type="button" onClick={retry} variant="outline">
            {INVENTORY_LABELS.retry}
          </Button>
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
