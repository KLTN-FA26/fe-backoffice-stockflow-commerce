"use client";

import { useState } from "react";

import {
  WAREHOUSE_LOCATION_COLUMNS as C,
  WAREHOUSE_LOCATION_LABELS as L,
  WAREHOUSE_LOCATION_PERMISSIONS,
} from "@/constants";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useWorkspaceWarehouse } from "@/lib/workspace";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";
import { DataTable } from "@/components/shared/DataTable";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";

import { LocationDetailPanel } from "./detail/LocationDetailPanel";
import { locationColumns } from "./location-columns";
import { LocationEmpty } from "./LocationEmpty";
import { labelFilterOptions, locationHeaderFilters } from "./location-header-filters";
import { LocationStockNotice } from "./LocationStockNotice";
import { LocationToolbar } from "./LocationToolbar";
import { LOCATION_PAGE_SIZES, useLocationColumns } from "./useLocationColumns";
import { useLocationFilters } from "./useLocationFilters";
import { useLocationListData, useStockAccess } from "./useLocationListData";

function LocationContent() {
  const warehouse = useWorkspaceWarehouse();
  const state = useLocationFilters();
  const stockAccess = useStockAccess(warehouse.prefix);
  const stockOk = stockAccess.access === "ok";
  // Trong lúc chờ biết quyền gán kho vẫn giữ cột hàng — tránh cột nhảy ra / vào
  const columns = useLocationColumns(stockOk || stockAccess.pending);
  const data = useLocationListData(warehouse, stockAccess.access, state, columns.pageSize);
  const [openCode, setOpenCode] = useState<string | null>(null);

  if (data.layout.isError)
    return (
      <LoadErrorState
        inline
        error={data.layout.error}
        copy={L.errorCopy}
        onRetry={() => void data.layout.refetch()}
      />
    );
  if (!data.layout.data) return <PageSkeleton variant="list" />;

  const options = labelFilterOptions(data.options, state.filters);
  const headerFilters = locationHeaderFilters(state, options, {
    sku: stockOk,
    stockFilter: stockOk && data.stockLoaded && !data.truncated,
  });
  const visible = locationColumns((row) => setOpenCode(row.locationCode)).filter(
    (col) => col.key === C.ACTIONS || columns.visible.some((key) => key === col.key),
  );
  const { page } = data;
  return (
    <>
      <LocationToolbar state={state} columns={columns} options={options} />
      <div className="flex flex-col gap-3">
        <LocationStockNotice access={stockAccess} data={data} />
        <div>
          <RefetchBar
            active={data.layout.isFetching || data.stock.isFetching}
            label={L.pageTitle}
            className="-mt-0.5"
          />
          <DataTable
            columns={withHeaderFilters(visible, headerFilters)}
            data={page.items}
            rowKey={(row) => row.locationCode}
            caption={`${L.pageTitle}: ${page.total}`}
            onRowClick={(row) => setOpenCode(row.locationCode)}
            emptyState={
              <LocationEmpty
                noLocations={data.rows.length === 0}
                prefix={warehouse.prefix}
                onClearFilters={state.reset}
              />
            }
            stickyHeader
            pageSizeOptions={LOCATION_PAGE_SIZES}
            serverPagination={{
              page: page.page,
              size: columns.pageSize,
              totalElements: page.total,
              totalPages: page.totalPages,
              hasNext: page.page < page.totalPages - 1,
              hasPrevious: page.page > 0,
              onPageChange: state.setPage,
              onPageSizeChange: (size) => {
                columns.setPageSize(size);
                state.setPage(0);
              },
            }}
          />
        </div>
      </div>
      <LocationDetailPanel
        row={data.rows.find((row) => row.locationCode === openCode) ?? null}
        prefix={warehouse.prefix}
        stockEnabled={stockOk}
        onClose={() => setOpenCode(null)}
      />
    </>
  );
}

/**
 * Danh sách vị trí của một kho (tab Kho, nhóm Bản đồ): mọi bin và khu vực có mã, tra / sao chép mã thẳng trên màn
 * thay vì phải in nhãn, kèm hàng và thùng LPN đang nằm ở vị trí (docs 06; docs 20 §4.1). Không giới hạn kho được gán
 * như bản đồ; phần hàng chỉ hiện ở kho được gán. Mức lấp đầy từng bin chờ BE (issue #456).
 */
export function LocationList() {
  return (
    <PermissionBoundary permissions={[WAREHOUSE_LOCATION_PERMISSIONS.viewPage]} variant="list">
      <div className="surface-soft">
        <h1 className="sr-only">{L.pageTitle}</h1>
        <LocationContent />
      </div>
    </PermissionBoundary>
  );
}
