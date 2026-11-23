"use client";

import { useRouter } from "next/navigation";
import { Gauge } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";

import { ADMIN_ROUTES, PAGE_SIZE, UI_LABELS, WAREHOUSE_CAPACITY_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { capacityActions } from "@/features/warehouse-capacity/lifecycle";
import { useCapacityBoards } from "@/features/warehouse-capacity/queries";
import { filterBoards } from "@/features/warehouse-capacity/selectors";

import { Alert } from "@/components/shared/Alert";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { CapacityLoadFailed } from "./CapacityLoadFailed";
import { buildCapacityColumns } from "./list/columns";
import { CapacityToolbar, useCapacityColumns } from "./list/CapacityToolbar";

const L = UI_LABELS.warehouseCapacity;
const E = UI_LABELS.emptyList;
const PAGE_SIZE_OPTIONS = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl] as const;

function CapacityListContent() {
  const router = useRouter();
  const actions = capacityActions({ can: usePermissionChecker() });
  // Search là thứ người khác mở link cũng thấy → URL (state-persistence.md); lọc tại chỗ vì BE trả đủ mọi kho
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const query = useCapacityBoards(actions.read);
  const columnState = useCapacityColumns();
  const clearSearch = () => void setQ(null);

  let body;
  if (!actions.read) {
    body = <EmptyState title={L.noReadTitle} description={L.noReadDescription} />;
  } else if (query.isError && !query.data) {
    body = <CapacityLoadFailed error={query.error} onRetry={() => void query.refetch()} />;
  } else if (!query.data) {
    body = <PageSkeleton variant="list" />;
  } else if (query.data.length === 0) {
    body = (
      <EmptyState
        icon={<Gauge className="size-8" />}
        title={L.empty.noDataTitle}
        description={L.empty.noDataDescription}
      />
    );
  } else {
    const rows = filterBoards(query.data, q);
    body =
      rows.length === 0 ? (
        <EmptyState
          icon={<Gauge className="size-8" />}
          title={E.noResultsTitle}
          description={L.empty.noResultsDescription}
          action={
            <Button type="button" variant="outline" size="sm" onClick={clearSearch}>
              {E.clearFilters}
            </Button>
          }
        />
      ) : (
        <>
          {/* Tải lại ngầm thất bại nhưng đã có dữ liệu → báo nhỏ, giữ bảng */}
          {query.isError && (
            <Alert tone="warning" className="mb-3">
              {L.refetchFailed}{" "}
              <Button
                variant="link"
                size="sm"
                onClick={() => void query.refetch()}
                className="h-auto p-0"
              >
                {UI_LABELS.common.retry}
              </Button>
            </Alert>
          )}
          <RefetchBar active={query.isFetching} label={L.refetching} />
          <DataTable
            columns={buildCapacityColumns().filter((column) =>
              columnState.visible.some((key) => key === column.key),
            )}
            data={rows}
            rowKey={(row) => row.warehouseId}
            caption={`${UI_LABELS.common.showing} ${rows.length} / ${query.data.length} ${L.listCaption}`}
            flagRow={(row) => row.projectedFreeM3 < 0}
            onRowClick={(row) =>
              router.push(ADMIN_ROUTES.warehouseCapacity.detail(row.warehouseCode))
            }
            stickyHeader
            pageSize={PAGE_SIZE.md}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />
          <p className="text-ink-tertiary mt-2 text-xs">
            {L.unitNote} {L.computedAtRead}
          </p>
        </>
      );
  }

  return (
    // Giao diện kiểu Vercel (`.surface-soft`): không title hiển thị — tên trang nằm ở breadcrumb topbar
    <div className="surface-soft">
      <h1 className="sr-only">{L.pageTitle}</h1>
      {actions.read && (
        <CapacityToolbar
          q={q}
          onSearchChange={(value) => void setQ(value || null)}
          columns={columnState}
        />
      )}
      {body}
    </div>
  );
}

/**
 * Bảng sức chứa kho (docs 06 §4.6, BR-20) — một dòng mỗi kho đang hoạt động người dùng được xem. Quản lý kho, Sale,
 * Điều phối sản xuất, Quản lý kinh doanh (`warehouse-capacity:VIEW_PAGE` + `:READ`; UI-only — Backend phải re-check
 * `@RequiresPermission`, và tự thu hẹp về kho được gán).
 */
export function WarehouseCapacityList() {
  return (
    <PermissionBoundary permissions={[WAREHOUSE_CAPACITY_PERMISSIONS.viewPage]} variant="list">
      <CapacityListContent />
    </PermissionBoundary>
  );
}
