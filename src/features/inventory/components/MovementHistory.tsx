"use client";

import Link from "next/link";

import {
  INVENTORY_LABELS,
  INVENTORY_PAGE_SIZES,
  INVENTORY_ROUTES,
  INVENTORY_STORAGE_KEYS,
} from "@/constants/inventory";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { useMovements } from "../queries";
import { useInventoryListFilters } from "../use-list-filters";
import {
  InventoryError,
  InventoryNoFilterResults,
  InventoryNoMovements,
  InventoryOffline,
} from "./InventoryFeedback";
import { buildMovementColumns } from "./inventory-columns";
import { serverPage } from "./inventory-page";
import { InventoryPermissionGate } from "./InventoryPermissionGate";
import { InventoryToolbar } from "./InventoryToolbar";

const MOVEMENT_COLUMNS = buildMovementColumns();

export function MovementHistory() {
  return (
    <InventoryPermissionGate permission={INVENTORY_PERMISSIONS.movementRead} variant="list">
      <MovementHistoryContent />
    </InventoryPermissionGate>
  );
}

function MovementHistoryContent() {
  const state = useInventoryListFilters(INVENTORY_STORAGE_KEYS.movements);
  // Ô gõ ghi URL ngay; request dùng giá trị debounce 300ms như các trang danh sách khác
  const sku = useDebouncedValue(state.filters.sku.trim(), 300);
  const location = useDebouncedValue(state.filters.location.trim(), 300);
  const query = useMovements({
    page: state.page - 1,
    size: state.size,
    sku: sku || undefined,
    location: location || undefined,
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
      <InventoryToolbar state={state} mode="movement" />
      {query.isFetching && !query.isLoading && (
        <div role="status" aria-label={INVENTORY_LABELS.fetching} className="bg-info h-1" />
      )}
      {query.isLoading ? (
        <PageSkeleton variant="list" />
      ) : query.isError ? (
        <InventoryError error={query.error} retry={() => void query.refetch()} />
      ) : (
        query.data && (
          <section aria-busy={query.isFetching}>
            {query.data.items.length ? (
              <DataTable
                columns={MOVEMENT_COLUMNS}
                data={query.data.items}
                rowKey={(row) => row.movementId}
                caption={INVENTORY_LABELS.movementTitle}
                pageSize={state.size}
                pageSizeOptions={INVENTORY_PAGE_SIZES}
                serverPagination={serverPage(query.data, state)}
              />
            ) : state.hasFilters ? (
              <InventoryNoFilterResults reset={() => void state.reset()} />
            ) : (
              <InventoryNoMovements />
            )}
          </section>
        )
      )}
    </div>
  );
}
