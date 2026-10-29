"use client";

import { INVENTORY_LABELS, INVENTORY_PAGE_SIZES } from "@/constants/inventory";
import { INVENTORY_OVERVIEW_PERMISSIONS } from "@/constants/permissions";

import { Alert } from "@/components/shared/Alert";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useStockAlerts } from "../queries";
import { alertKindLabel } from "../selectors";
import { useAlertListFilters } from "../use-alert-filters";
import {
  InventoryError,
  InventoryInvalidPage,
  InventoryNoFilterResults,
  InventoryOffline,
} from "./InventoryFeedback";
import { buildAlertColumns } from "./inventory-columns";
import { isInvalidPage, serverPage } from "./inventory-page";
import { InventoryPermissionGate } from "./InventoryPermissionGate";

const L = INVENTORY_LABELS;
const ALERT_COLUMNS = buildAlertColumns();
// Alerts still in force: an acknowledged alert is seen, not cleared (StockAlertResponse.status).
const LIVE_STATUSES = ["OPEN", "ACKNOWLEDGED"] as const;
const { alertViewPage, alertRead } = INVENTORY_OVERVIEW_PERMISSIONS;

/**
 * Cảnh báo tồn kho — đích deep link của thông báo INVENTORY_ALERT (SCRUM-147). VIEW_PAGE mở màn,
 * READ cho dữ liệu (BE ADR-0004 tách hai quyền). UI-only — BE re-check @RequiresPermission và phạm vi
 * kho (StockAlertsImpl: kho ngoài phạm vi → 403 OUT_OF_DATA_SCOPE).
 */
export function InventoryAlertList() {
  return (
    <InventoryPermissionGate allOf={[alertViewPage, alertRead]} variant="list">
      <InventoryAlertListContent />
    </InventoryPermissionGate>
  );
}

function InventoryAlertListContent() {
  const state = useAlertListFilters();
  const { kind, warehouseId, rejected } = state.filters;
  const query = useStockAlerts({
    kind: kind ? [kind] : undefined,
    status: [...LIVE_STATUSES],
    warehouseId: warehouseId ?? undefined,
    page: state.page - 1,
    size: state.size,
  });
  const filtered = kind !== null || warehouseId !== null;
  return (
    <div className="surface-soft space-y-[var(--card-pad)]">
      <h1 className="sr-only">{L.alertListTitle}</h1>
      <InventoryOffline />
      {rejected && (
        <div role="alert">
          <Alert tone="warning">{L.alertInvalidLink}</Alert>
        </div>
      )}
      {state.hasFilters && (
        <div className="flex flex-wrap items-center gap-[var(--el-gap)] text-sm">
          <span className="text-ink-secondary">{L.alertFilter}:</span>
          <Badge variant="outline">{kind ? alertKindLabel(kind) : L.alertAllKinds}</Badge>
          {warehouseId && (
            <Badge variant="outline" className="font-mono">
              {L.alertWarehouseFilter(warehouseId)}
            </Badge>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => void state.reset()}>
            {L.reset}
          </Button>
        </div>
      )}
      {query.isFetching && !query.isLoading && (
        <div role="status" aria-label={L.fetching} className="bg-info h-1" />
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
                columns={ALERT_COLUMNS}
                data={query.data.items}
                rowKey={(row) => row.id}
                caption={L.alertListTitle}
                pageSize={state.size}
                pageSizeOptions={INVENTORY_PAGE_SIZES}
                serverPagination={serverPage(query.data, state)}
              />
            ) : isInvalidPage(query.data) ? (
              <InventoryInvalidPage toFirstPage={() => void state.setPage(1)} />
            ) : filtered ? (
              <InventoryNoFilterResults reset={() => void state.reset()} />
            ) : (
              <EmptyState title={L.noAlerts} description={L.noAlertsDescription} />
            )}
          </section>
        )
      )}
    </div>
  );
}
