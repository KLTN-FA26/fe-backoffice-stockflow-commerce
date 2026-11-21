"use client";

import { PUTAWAY_COLUMNS as C, PUTAWAY_LABELS, PUTAWAY_TASK_PERMISSIONS } from "@/constants";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";
import { usePutawayTasks } from "@/features/putaway/queries";
import { filterPutawayTasks, sortByLpn } from "@/features/putaway/selectors";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Alert } from "@/components/shared/Alert";
import { ColumnFilterButton, withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";
import { DataTable } from "@/components/shared/DataTable";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";

import { putawayColumns } from "./putaway-columns";
import { PutawayEmpty } from "./PutawayEmpty";
import { PutawayToolbar } from "./PutawayToolbar";
import { usePutawayColumns } from "./usePutawayColumns";
import { usePutawayFilters } from "./usePutawayFilters";

import type { PutawayFiltersState } from "./usePutawayFilters";

const L = PUTAWAY_LABELS;

/** Lọc chữ trên header cột — chỉ lọc dòng đã tải, không gọi lại API (data-table-mode-a §4.1). */
function headerFilters({ filters, set }: PutawayFiltersState) {
  const text = (label: string, value: string, onChange: (next: string) => void) => (
    <ColumnFilterButton
      label={label}
      value={value}
      placeholder={L.columnSearch(label)}
      onChange={onChange}
    />
  );
  return {
    [C.LPN]: text(L.column.lpn, filters.lpn, (lpn) => set({ lpn })),
    [C.SKU]: text(L.column.sku, filters.sku, (sku) => set({ sku })),
    [C.SOURCE_LOCATION]: text(L.column.sourceLocation, filters.location, (location) =>
      set({ location }),
    ),
  };
}

function PutawayContent() {
  const directory = useWarehouseDirectory();
  const warehouses = directory.data ?? [];
  const only = warehouses.length === 1 ? (warehouses[0]?.warehouseId ?? null) : null;
  const state = usePutawayFilters(only);
  const columns = usePutawayColumns();
  const query = usePutawayTasks(state.params, { enabled: state.ready });
  const data = query.data;
  const rows = data ? sortByLpn(filterPutawayTasks(data.items, state.text)) : [];
  const emptyKind = !state.ready
    ? "chooseWarehouse"
    : data?.items.length === 0
      ? "none"
      : "noMatch";

  return (
    <>
      <PutawayToolbar state={state} columns={columns} warehouses={warehouses} />
      {query.isError ? (
        <LoadErrorState
          inline
          error={query.error}
          copy={L.errorCopy}
          onRetry={() => void query.refetch()}
        />
      ) : state.ready && !data ? (
        <PageSkeleton variant="list" />
      ) : (
        <div className="flex flex-col gap-3">
          {data && data.totalElements > data.items.length && (
            <Alert tone="warning">{L.truncated(data.items.length, data.totalElements)}</Alert>
          )}
          <div>
            <RefetchBar
              active={query.isFetching && !!data}
              label={L.refetching}
              className="-mt-0.5"
            />
            <DataTable
              data={rows}
              columns={withHeaderFilters(putawayColumns(columns.visible), headerFilters(state))}
              rowKey={(row) => row.id}
              caption={L.title}
              stickyHeader
              emptyState={
                <PutawayEmpty
                  kind={emptyKind}
                  onClearFilters={() => {
                    state.clearText();
                    state.set({ receipt: null });
                  }}
                />
              }
            />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Màn "Cất hàng" (docs 05 §4.2, trang danh sách style Vercel): thùng chờ cất của một kho — nhân viên kho thấy mọi
 * nhiệm vụ của kho, không giao theo người (§2). Bấm LPN / nút cất để sang màn cất một thùng có bin gợi ý.
 */
export function PutawayList() {
  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.title}</h1>
      <PermissionBoundary permissions={[PUTAWAY_TASK_PERMISSIONS.read]} variant="list">
        <PutawayContent />
      </PermissionBoundary>
    </div>
  );
}
