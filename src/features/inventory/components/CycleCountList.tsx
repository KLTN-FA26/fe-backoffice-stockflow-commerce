"use client";

import { useState } from "react";

import { WORKSPACE_PATHS } from "@/constants";
import { CYCLE_COUNT_LABELS } from "@/constants/cycle-count";
import { INVENTORY_PAGE_SIZES } from "@/constants/inventory";
import { CYCLE_COUNT_PERMISSIONS } from "@/constants/permissions";

import { useCan } from "@/lib/auth";
import { useWorkspaceHref, useWorkspaceWarehouse } from "@/lib/workspace";

import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";

import { useCycleCounts } from "../cycle-count-queries";
import { useCycleCountFilters } from "../use-cycle-count-filters";
import { buildCycleCountColumns, isOpenCycleCount } from "./cycle-count-columns";
import { CycleCountCreateDialog } from "./CycleCountCreateDialog";
import { CycleCountToolbar } from "./CycleCountToolbar";
import {
  InventoryError,
  InventoryInvalidPage,
  InventoryNoFilterResults,
  InventoryOffline,
} from "./InventoryFeedback";
import { isInvalidPage, serverPage } from "./inventory-page";
import { InventoryPermissionGate } from "./InventoryPermissionGate";
import { useCycleCountColumns } from "./useCycleCountColumns";

const L = CYCLE_COUNT_LABELS;

export function CycleCountList() {
  return (
    <InventoryPermissionGate
      allOf={[CYCLE_COUNT_PERMISSIONS.viewPage, CYCLE_COUNT_PERMISSIONS.read]}
      variant="list"
    >
      <CycleCountListContent />
    </InventoryPermissionGate>
  );
}

function CycleCountListContent() {
  const state = useCycleCountFilters();
  const visibleColumns = useCycleCountColumns();
  // UI-only — Backend phải re-check (inventory-cycle-counts:CREATE, docs 20 §4.2 a)
  const canPlan = useCan(CYCLE_COUNT_PERMISSIONS.create);
  const [planning, setPlanning] = useState(false);
  const warehouse = useWorkspaceWarehouse();
  const href = useWorkspaceHref();
  const columns = buildCycleCountColumns(visibleColumns.visible, (id) =>
    href(WORKSPACE_PATHS.cycleCount(id)),
  );
  const query = useCycleCounts({
    page: state.page - 1,
    size: state.size,
    status: state.status ?? undefined,
    warehouseId: warehouse.id,
  });
  return (
    // Trang danh sách style Vercel (`.surface-soft`, mẫu ProductList): không tiêu đề hiển thị — breadcrumb là tên
    // trang. Phiếu do quản lý kho lập tay (nút "Lập phiếu" trên toolbar) hoặc hệ thống tự mở khi báo thiếu thùng.
    <div className="surface-soft">
      <h1 className="sr-only">{L.title}</h1>
      {/* Banner mất mạng cách toolbar như thanh Cấu hình; online → div rỗng, ẩn */}
      <div className="mb-3 empty:hidden">
        <InventoryOffline />
      </div>
      <CycleCountToolbar
        state={state}
        columns={visibleColumns}
        canPlan={canPlan}
        onPlan={() => setPlanning(true)}
      />
      {planning && <CycleCountCreateDialog onClose={() => setPlanning(false)} />}
      {query.isLoading ? (
        <PageSkeleton variant="list" />
      ) : query.isError ? (
        <InventoryError error={query.error} retry={() => void query.refetch()} />
      ) : (
        query.data && (
          <section aria-busy={query.isFetching}>
            <RefetchBar
              active={query.isFetching && !query.isLoading}
              label={L.fetching}
              className="-mt-0.5"
            />
            {query.data.items.length ? (
              <DataTable
                stickyHeader
                columns={columns}
                data={query.data.items}
                rowKey={(row) => row.id}
                flagRow={isOpenCycleCount}
                caption={L.title}
                pageSize={state.size}
                pageSizeOptions={INVENTORY_PAGE_SIZES}
                serverPagination={serverPage(query.data, state)}
              />
            ) : isInvalidPage(query.data) ? (
              <InventoryInvalidPage toFirstPage={() => void state.setPage(1)} />
            ) : state.hasFilters ? (
              <InventoryNoFilterResults reset={() => void state.reset()} />
            ) : (
              <EmptyState title={L.noCounts} description={L.noCountsDescription} />
            )}
          </section>
        )
      )}
    </div>
  );
}
