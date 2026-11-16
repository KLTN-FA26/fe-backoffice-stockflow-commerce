"use client";

import { CYCLE_COUNT_LABELS, CYCLE_COUNT_STATUSES } from "@/constants/cycle-count";
import { INVENTORY_LABELS, INVENTORY_PAGE_SIZES } from "@/constants/inventory";
import { CYCLE_COUNT_PERMISSIONS } from "@/constants/permissions";

import { statusLabelVi } from "@/lib/status-map";

import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useCycleCounts } from "../cycle-count-queries";
import { useCycleCountFilters } from "../use-cycle-count-filters";
import { buildCycleCountColumns, isOpenCycleCount } from "./cycle-count-columns";
import {
  InventoryError,
  InventoryInvalidPage,
  InventoryNoFilterResults,
  InventoryOffline,
} from "./InventoryFeedback";
import { isInvalidPage, serverPage } from "./inventory-page";
import { InventoryPermissionGate } from "./InventoryPermissionGate";

const L = CYCLE_COUNT_LABELS;
const ALL = "all";
const COLUMNS = buildCycleCountColumns();

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
  const query = useCycleCounts({
    page: state.page - 1,
    size: state.size,
    status: state.status ?? undefined,
  });
  return (
    // Giao diện kiểu Vercel như danh sách điều chỉnh tồn (`.surface-soft`): không tiêu đề hiển thị — breadcrumb là
    // tên trang. Phiếu do quản lý kho lập hoặc hệ thống tự mở khi báo thiếu thùng, nên không có nút tạo ở đây.
    <div className="surface-soft space-y-[var(--card-pad)]">
      <h1 className="sr-only">{L.title}</h1>
      <InventoryOffline />
      <div className="flex flex-wrap items-center gap-[var(--el-gap)]">
        <Label htmlFor="cycle-count-status" className="text-ink-secondary text-[0.8125rem]">
          {L.statusFilter}
        </Label>
        <Select
          value={state.status ?? ALL}
          onValueChange={(value) =>
            void state.setStatus(CYCLE_COUNT_STATUSES.find((status) => status === value) ?? null)
          }
        >
          <SelectTrigger id="cycle-count-status" className={`${FORM_SELECT_CLASS} w-[13rem]`}>
            <SelectValue />
          </SelectTrigger>
          <TitledSelectContent title={L.statusFilter}>
            <SelectItem value={ALL}>{L.all}</SelectItem>
            {CYCLE_COUNT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabelVi(status, "stock") ?? status}
              </SelectItem>
            ))}
          </TitledSelectContent>
        </Select>
        {state.hasFilters && (
          <Button type="button" variant="outline" size="sm" onClick={() => void state.reset()}>
            {INVENTORY_LABELS.reset}
          </Button>
        )}
      </div>
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
                columns={COLUMNS}
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
