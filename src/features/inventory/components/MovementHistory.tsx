"use client";

import Link from "next/link";

import { INVENTORY_LABELS, INVENTORY_ROUTES, INVENTORY_STORAGE_KEYS } from "@/constants/inventory";

import { useAuthStore } from "@/lib/auth/auth-store";

import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { canViewInventory } from "../lifecycle";
import { useMovements } from "../queries";
import { useInventoryListFilters } from "../use-list-filters";
import {
  InventoryDenied,
  InventoryError,
  InventoryNoFilterResults,
  InventoryNoMovements,
  InventoryOffline,
} from "./InventoryFeedback";
import { InventoryPager } from "./InventoryPager";
import { MovementFilters } from "./MovementFilters";
import { MovementTable } from "./MovementTable";

export function MovementHistory() {
  const auth = useAuthStore();
  return canViewInventory(auth.effectiveRoles()) ? <MovementHistoryContent /> : <InventoryDenied />;
}

function MovementHistoryContent() {
  const state = useInventoryListFilters(INVENTORY_STORAGE_KEYS.movements);
  const query = useMovements({
    page: state.page - 1,
    size: state.size,
    sku: state.filters.sku || undefined,
    location: state.filters.location || undefined,
    type: state.filters.type ?? undefined,
  });
  return (
    <div className="space-y-[var(--card-pad)]">
      <PageHeader
        title={INVENTORY_LABELS.movementTitle}
        subtitle={INVENTORY_LABELS.movementSubtitle}
        actions={
          <Button className="rounded-[var(--r-sm)]" asChild variant="outline" size="sm">
            <Link href={INVENTORY_ROUTES.adjustments}>{INVENTORY_LABELS.adjustmentTitle}</Link>
          </Button>
        }
      />
      <InventoryOffline />
      <MovementFilters state={state} />
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
              <MovementTable items={query.data.items} />
            ) : state.hasFilters ? (
              <InventoryNoFilterResults reset={() => void state.reset()} />
            ) : (
              <InventoryNoMovements />
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
