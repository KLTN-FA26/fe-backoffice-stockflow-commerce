"use client";

import {
  CARTON_LIST_COLUMNS as C,
  CARTON_LIST_LABELS as L,
  CARTON_LIST_LIMITS,
  CARTON_SEARCH_MIN,
  STOCK_PACKAGE_PERMISSIONS,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { useCartonLookup } from "@/features/inventory/carton-queries";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Alert } from "@/components/shared/Alert";
import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";
import { DataTable } from "@/components/shared/DataTable";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";

import { cartonColumns } from "./carton-columns";
import { cartonHeaderFilters } from "./carton-header-filters";
import { CartonEmpty } from "./CartonEmpty";
import { CartonToolbar } from "./CartonToolbar";
import { CartonDetailPanel } from "./detail/CartonDetailPanel";
import { useCartonColumns } from "./useCartonColumns";
import { useCartonFilters } from "./useCartonFilters";
import { useCartonWarehouses } from "./useCartonWarehouses";

import type { CartonSort } from "@/constants";

/** Cột bấm sắp xếp được ↔ `sort` của BE (`StockPackageSearch.SORTABLE`). */
const SORT_OF: Partial<Record<string, CartonSort>> = {
  [C.LPN]: "lpn",
  [C.PRODUCT]: "sku",
  [C.LOCATION]: "locationCode",
  [C.RECEIVED_AT]: "receivedAt",
};
const COLUMN_OF = Object.fromEntries(Object.entries(SORT_OF).map(([key, sort]) => [sort, key]));

function CartonContent() {
  const columns = useCartonColumns();
  const filters = useCartonFilters(columns.pageSize);
  const canRead = useCan(STOCK_PACKAGE_PERMISSIONS.read);
  const warehouses = useCartonWarehouses();
  const query = useCartonLookup(filters.params, canRead);
  const { state } = filters;

  if (!canRead) return <LoadErrorState inline error={null} kind="no-read" copy={L.errorCopy} />;
  const visible = cartonColumns((row) => filters.openDetail(row.lpn)).filter(
    (col) => col.key === C.ACTIONS || columns.visible.some((key) => key === col.key),
  );
  const searchTooShort = state.q.trim().length > 0 && state.q.trim().length < CARTON_SEARCH_MIN;
  const data = query.data;
  return (
    <>
      <CartonToolbar filters={filters} columns={columns} warehouses={warehouses} />
      <div className="flex flex-col gap-3">
        {searchTooShort && <Alert tone="info">{L.searchTooShort(CARTON_SEARCH_MIN)}</Alert>}
        {query.isError ? (
          <LoadErrorState
            inline
            error={query.error}
            copy={L.errorCopy}
            onRetry={() => void query.refetch()}
          />
        ) : !data ? (
          <PageSkeleton variant="list" />
        ) : (
          <div>
            <RefetchBar active={query.isFetching} label={L.title} className="-mt-0.5" />
            <DataTable
              columns={withHeaderFilters(visible, cartonHeaderFilters(filters, warehouses))}
              data={data.items}
              rowKey={(row) => row.lpn}
              caption={`${L.title}: ${data.totalElements}`}
              onRowClick={(row) => filters.openDetail(row.lpn)}
              emptyState={
                <CartonEmpty filtered={filters.hasFilters} onClearFilters={filters.reset} />
              }
              stickyHeader
              pageSizeOptions={CARTON_LIST_LIMITS.pageSizes}
              serverPagination={{
                page: data.page,
                size: columns.pageSize,
                totalElements: data.totalElements,
                totalPages: Math.max(1, data.totalPages),
                hasNext: data.hasNext,
                hasPrevious: data.hasPrevious,
                onPageChange: filters.setPage,
                onPageSizeChange: (size) => {
                  columns.setPageSize(size);
                  filters.setPage(0);
                },
              }}
              serverSorting={{
                key: state.sort ? (COLUMN_OF[state.sort] ?? null) : null,
                direction: state.dir ?? "asc",
                onChange: (key, direction) =>
                  filters.set({ sort: SORT_OF[key] ?? null, dir: direction }),
              }}
            />
          </div>
        )}
      </div>
      <CartonDetailPanel lpn={state.lpn} onClose={() => filters.openDetail(null)} />
    </>
  );
}

/**
 * Thùng hàng (LPN) — tra cứu mọi thùng ở các kho của người xem theo kho / SKU / vị trí / lô / một phần LPN / trạng thái,
 * kèm sản phẩm, trạng thái tồn, nguồn gốc, đơn đang giữ và việc đang làm (docs 20 §4.1; BE #454). Mã LPN sao chép được
 * để dán vào ô quét thay vì phải in tem.
 */
export function CartonList() {
  return (
    <PermissionBoundary permissions={[STOCK_PACKAGE_PERMISSIONS.viewPage]} variant="list">
      <div className="surface-soft">
        <h1 className="sr-only">{L.title}</h1>
        <CartonContent />
      </div>
    </PermissionBoundary>
  );
}
