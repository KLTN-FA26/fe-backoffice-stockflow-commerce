"use client";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { INVENTORY_COPY } from "../constants";
import { useInventoryOverviewData } from "../queries";
import { InventoryOverviewView } from "./InventoryOverviewView";

import type { InventoryService } from "../service";

/** Explicit injection: mounting this component never silently selects a real API. */
export function InventoryOverview({
  service,
  showReservations = true,
}: {
  service: InventoryService;
  showReservations?: boolean;
}) {
  const query = useInventoryOverviewData(service);
  if (query.isPending) return <PageSkeleton variant="detail" />;
  if (query.isError)
    return (
      <EmptyState
        title={INVENTORY_COPY.error}
        action={<Button onClick={() => void query.refetch()}>{INVENTORY_COPY.retry}</Button>}
      />
    );
  return (
    <InventoryOverviewView
      data={query.data}
      service={service}
      showReservations={showReservations}
    />
  );
}
