"use client";

import Link from "next/link";
import { cn } from "cn";
import { SlidersHorizontal } from "lucide-react";

import {
  INVENTORY_LABELS,
  INVENTORY_PAGE_SIZES,
  INVENTORY_ROUTES,
  INVENTORY_STORAGE_KEYS,
} from "@/constants/inventory";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePermissionChecker } from "@/lib/auth";

import { DataTable } from "@/components/shared/DataTable";
import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { useMovements } from "../queries";
import { useInventoryListFilters } from "../use-list-filters";
import {
  InventoryError,
  InventoryInvalidPage,
  InventoryNoFilterResults,
  InventoryNoMovements,
  InventoryOffline,
} from "./InventoryFeedback";
import { buildMovementColumns } from "./inventory-columns";
import { isInvalidPage, serverPage } from "./inventory-page";
import { InventoryPermissionGate } from "./InventoryPermissionGate";
import { InventoryToolbar } from "./InventoryToolbar";

const MOVEMENT_COLUMNS = buildMovementColumns();

export function MovementHistory() {
  return (
    <InventoryPermissionGate
      allOf={[INVENTORY_PERMISSIONS.movementViewPage, INVENTORY_PERMISSIONS.movementRead]}
      variant="list"
    >
      <MovementHistoryContent />
    </InventoryPermissionGate>
  );
}

function MovementHistoryContent() {
  const can = usePermissionChecker();
  // Shortcut chỉ hiện khi mở được trang đích — cùng điều kiện với gate của AdjustmentList
  const canViewAdjustments =
    can(INVENTORY_PERMISSIONS.adjustmentViewPage) && can(INVENTORY_PERMISSIONS.adjustmentRead);
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
    // Giao diện kiểu Vercel như danh sách sản phẩm (globals.css `.surface-soft`): không tiêu đề hiển
    // thị — breadcrumb là tên trang; link sang Điều chỉnh tồn ở cuối toolbar.
    <div className="surface-soft space-y-[var(--card-pad)]">
      <h1 className="sr-only">{INVENTORY_LABELS.movementTitle}</h1>
      <InventoryOffline />
      <InventoryToolbar
        state={state}
        mode="movement"
        actions={
          canViewAdjustments && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className={cn(
                "border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted",
                TOOLBAR_ACTION_CLASS,
              )}
            >
              <Link href={INVENTORY_ROUTES.adjustments}>
                <SlidersHorizontal className="text-dot-info size-3.5" />
                {INVENTORY_LABELS.adjustmentTitle}
              </Link>
            </Button>
          )
        }
      />
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
                stickyHeader
                columns={MOVEMENT_COLUMNS}
                data={query.data.items}
                rowKey={(row) => row.movementId}
                caption={INVENTORY_LABELS.movementTitle}
                pageSize={state.size}
                pageSizeOptions={INVENTORY_PAGE_SIZES}
                serverPagination={serverPage(query.data, state)}
              />
            ) : isInvalidPage(query.data) ? (
              <InventoryInvalidPage toFirstPage={() => void state.setPage(1)} />
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
