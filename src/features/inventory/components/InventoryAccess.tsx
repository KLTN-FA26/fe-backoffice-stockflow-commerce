"use client";

import { INVENTORY_PERMISSIONS, UI_LABELS } from "@/constants";
import { hasPermission, useMyPermissions } from "@/lib/auth";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { INVENTORY_COPY } from "../constants";
import { InventoryOverview } from "./InventoryOverview";

import type { InventoryService } from "../service";

/** UI route guard. The BE must re-check READ on each inventory request. */
export function InventoryAccess({ service }: { service: InventoryService }) {
  const { data, isPending, isError, fetchStatus, refetch } = useMyPermissions();
  const { stock, reservations } = INVENTORY_PERMISSIONS;

  if (isPending && fetchStatus !== "paused") return <PageSkeleton variant="list" />;
  if (isError || fetchStatus === "paused") {
    return (
      <EmptyState
        title={UI_LABELS.loadError.permissionsTitle}
        description={UI_LABELS.loadError.permissionsDescription}
        action={
          <Button variant="outline" onClick={() => void refetch()}>
            {UI_LABELS.common.retry}
          </Button>
        }
      />
    );
  }
  if (!hasPermission(data, stock.viewPage)) {
    return <EmptyState title={UI_LABELS.loadError.forbiddenTitle} />;
  }
  if (!hasPermission(data, stock.read)) {
    return (
      <div className="space-y-[var(--card-pad)]">
        <PageHeader title={INVENTORY_COPY.title} subtitle={INVENTORY_COPY.subtitle} />
        <EmptyState title={UI_LABELS.loadError.noReadTitle} />
      </div>
    );
  }

  const showReservations =
    hasPermission(data, reservations.viewPage) && hasPermission(data, reservations.read);
  return <InventoryOverview service={service} showReservations={showReservations} />;
}
