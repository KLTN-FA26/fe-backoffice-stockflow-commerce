"use client";

import Link from "next/link";
import { cn } from "cn";
import { History } from "lucide-react";

import {
  INVENTORY_LABELS,
  INVENTORY_PAGE_SIZES,
  INVENTORY_ROUTES,
  INVENTORY_STORAGE_KEYS,
} from "@/constants/inventory";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCan } from "@/lib/auth";

import { EmptyState } from "@/components/shared/EmptyState";
import { DataTable } from "@/components/shared/DataTable";
import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { useAdjustments } from "../queries";
import { useInventoryListFilters } from "../use-list-filters";
import {
  InventoryError,
  InventoryInvalidPage,
  InventoryNoFilterResults,
  InventoryOffline,
} from "./InventoryFeedback";
import { buildAdjustmentColumns, isPendingAdjustment } from "./inventory-columns";
import { isInvalidPage, serverPage } from "./inventory-page";
import { InventoryToolbar } from "./InventoryToolbar";
import { InventoryPermissionGate } from "./InventoryPermissionGate";

const ADJUSTMENT_COLUMNS = buildAdjustmentColumns();

export function AdjustmentList() {
  return (
    <InventoryPermissionGate permission={INVENTORY_PERMISSIONS.adjustmentRead} variant="list">
      <AdjustmentListContent />
    </InventoryPermissionGate>
  );
}

function AdjustmentListContent() {
  const canCreate = useCan(INVENTORY_PERMISSIONS.stockUpdate);
  const state = useInventoryListFilters(INVENTORY_STORAGE_KEYS.adjustments);
  // Ô gõ ghi URL ngay; request dùng giá trị debounce 300ms như các trang danh sách khác
  const sku = useDebouncedValue(state.filters.sku.trim(), 300);
  const location = useDebouncedValue(state.filters.location.trim(), 300);
  const query = useAdjustments({
    page: state.page - 1,
    size: state.size,
    sku: sku || undefined,
    location: location || undefined,
    status: state.filters.status ?? undefined,
  });
  const createAction = canCreate ? (
    <Button className={cn("bg-brand hover:bg-brand-hover", TOOLBAR_ACTION_CLASS)} asChild size="sm">
      <Link href={INVENTORY_ROUTES.createAdjustment}>{INVENTORY_LABELS.createAdjustment}</Link>
    </Button>
  ) : undefined;
  return (
    // Giao diện kiểu Vercel như danh sách sản phẩm (globals.css `.surface-soft`): không tiêu đề hiển
    // thị — breadcrumb là tên trang; link sang Lịch sử biến động + nút tạo ở cuối toolbar.
    <div className="surface-soft space-y-[var(--card-pad)]">
      <h1 className="sr-only">{INVENTORY_LABELS.adjustmentTitle}</h1>
      <InventoryOffline />
      <InventoryToolbar
        state={state}
        mode="adjustment"
        actions={
          <>
            <Button
              asChild
              variant="outline"
              size="sm"
              className={cn(
                "border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted",
                TOOLBAR_ACTION_CLASS,
              )}
            >
              <Link href={INVENTORY_ROUTES.movements}>
                <History className="text-dot-info size-3.5" />
                {INVENTORY_LABELS.movementTitle}
              </Link>
            </Button>
            {createAction}
          </>
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
                columns={ADJUSTMENT_COLUMNS}
                data={query.data.items}
                rowKey={(row) => row.adjustmentId}
                flagRow={isPendingAdjustment}
                caption={INVENTORY_LABELS.adjustmentTitle}
                pageSize={state.size}
                pageSizeOptions={INVENTORY_PAGE_SIZES}
                serverPagination={serverPage(query.data, state)}
              />
            ) : isInvalidPage(query.data) ? (
              <InventoryInvalidPage toFirstPage={() => void state.setPage(1)} />
            ) : state.hasFilters ? (
              <InventoryNoFilterResults reset={() => void state.reset()} />
            ) : (
              <EmptyState
                title={INVENTORY_LABELS.noAdjustments}
                description={INVENTORY_LABELS.noAdjustmentsDescription}
                action={createAction}
              />
            )}
          </section>
        )
      )}
    </div>
  );
}
