"use client";

import Link from "next/link";

import { INVENTORY_LABELS, INVENTORY_ROUTES, INVENTORY_STORAGE_KEYS } from "@/constants/inventory";

import { useAuthStore } from "@/lib/auth/auth-store";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { canRequestAdjustment, canViewInventory } from "../lifecycle";
import { useAdjustments } from "../queries";
import { useInventoryListFilters } from "../use-list-filters";
import { AdjustmentFilters } from "./AdjustmentFilters";
import { AdjustmentTable } from "./AdjustmentTable";
import {
  InventoryDenied,
  InventoryError,
  InventoryNoFilterResults,
  InventoryOffline,
} from "./InventoryFeedback";
import { InventoryPager } from "./InventoryPager";

export function AdjustmentList() {
  const auth = useAuthStore();
  return canViewInventory(auth.effectiveRoles()) ? (
    <AdjustmentListContent canCreate={canRequestAdjustment(auth.effectiveRoles())} />
  ) : (
    <InventoryDenied />
  );
}

function AdjustmentListContent({ canCreate }: { canCreate: boolean }) {
  const state = useInventoryListFilters(INVENTORY_STORAGE_KEYS.adjustments);
  const query = useAdjustments({
    page: state.page - 1,
    size: state.size,
    sku: state.filters.sku || undefined,
    location: state.filters.location || undefined,
    status: state.filters.status ?? undefined,
  });
  const createAction = canCreate ? (
    <Button className="rounded-[var(--r-sm)]" asChild size="sm">
      <Link href={INVENTORY_ROUTES.createAdjustment}>{INVENTORY_LABELS.createAdjustment}</Link>
    </Button>
  ) : undefined;
  return (
    <div className="space-y-[var(--card-pad)]">
      <PageHeader
        title={INVENTORY_LABELS.adjustmentTitle}
        subtitle={INVENTORY_LABELS.approvalPolicy}
        actions={
          <>
            <Button className="rounded-[var(--r-sm)]" asChild variant="outline" size="sm">
              <Link href={INVENTORY_ROUTES.movements}>{INVENTORY_LABELS.movementTitle}</Link>
            </Button>
            {createAction}
          </>
        }
      />
      <InventoryOffline />
      <AdjustmentFilters state={state} />
      {query.isFetching && !query.isLoading && (
        <div role="status" aria-label={INVENTORY_LABELS.fetching} className="bg-info h-1" />
      )}
      {query.isLoading ? (
        <PageSkeleton variant="list" />
      ) : query.isError ? (
        <InventoryError error={query.error} retry={() => void query.refetch()} />
      ) : (
        query.data && (
          <section
            aria-busy={query.isFetching}
            className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border"
          >
            {query.data.items.length ? (
              <AdjustmentTable items={query.data.items} />
            ) : state.hasFilters ? (
              <InventoryNoFilterResults reset={() => void state.reset()} />
            ) : (
              <EmptyState
                title={INVENTORY_LABELS.noAdjustments}
                description={INVENTORY_LABELS.noAdjustmentsDescription}
                action={createAction}
              />
            )}
            <InventoryPager
              data={query.data}
              pending={query.isFetching}
              size={state.size}
              setSize={state.setSize}
              setPage={(page) => void state.setPage(page)}
            />
          </section>
        )
      )}
    </div>
  );
}
