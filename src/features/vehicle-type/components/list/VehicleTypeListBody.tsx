"use client";

import { Truck } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { classifyLoadError } from "@/lib/api/load-error";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import { PAGE_SIZE_OPTIONS } from "./constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { VehicleType } from "@/features/vehicle-type/types";
import type { VehicleTypeListState } from "./useVehicleTypeListState";

const E = UI_LABELS.emptyList;
const L = UI_LABELS.vehicleType;
const LE = UI_LABELS.loadError;

/** Lỗi tải: mất mạng / sai hợp đồng / 5xx hiện đúng câu, có nút thử lại. */
function LoadFailed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const kind = classifyLoadError(error);
  const description =
    kind === "network"
      ? LE.networkDescription
      : kind === "invalid-data"
        ? LE.invalidDataDescription
        : kind === "forbidden"
          ? L.forbiddenDescription
          : LE.serverDescription;
  return (
    <EmptyState
      icon={<Truck className="size-8" />}
      title={L.loadFailedTitle}
      description={description}
      action={
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {UI_LABELS.common.retry}
        </Button>
      }
    />
  );
}

/**
 * Vùng bảng — tách trạng thái (api-conventions §8): tải lần đầu, lỗi tải, chưa có loại xe, lọc không
 * ra kết quả. Hai loại empty là hai thông điệp khác nhau.
 */
export function VehicleTypeListBody({
  s,
  columns,
  onRowClick,
}: {
  s: VehicleTypeListState;
  columns: ColumnDef<VehicleType>[];
  onRowClick?: (row: VehicleType) => void;
}) {
  const { query } = s;
  if (!s.canRead) {
    return <EmptyState title={L.noReadTitle} description={L.noReadDescription} />;
  }
  if (query.isError && !query.data) {
    return <LoadFailed error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.isPending) return <PageSkeleton variant="list" />;
  if (s.emptyState === "no-data") {
    return (
      <EmptyState
        icon={<Truck className="size-8" />}
        title={L.empty.noDataTitle}
        description={L.empty.noDataDescription}
      />
    );
  }
  if (s.emptyState === "no-results" || s.emptyState === "invalid-page") {
    const invalidPage = s.emptyState === "invalid-page";
    return (
      <EmptyState
        icon={<Truck className="size-8" />}
        title={invalidPage ? E.invalidPageTitle : E.noResultsTitle}
        description={invalidPage ? E.invalidPageDescription : L.empty.noResultsDescription}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => (invalidPage ? s.setPage(1) : s.clearFilters())}
          >
            {invalidPage ? E.firstPage : E.clearFilters}
          </Button>
        }
      />
    );
  }
  const page = query.data;
  if (!page) return <PageSkeleton variant="list" />;
  return (
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
        columns={columns}
        data={page.items}
        rowKey={(row) => row.vehicleTypeId}
        caption={`${UI_LABELS.common.showing} ${page.items.length} / ${page.totalElements} ${L.listCaption}`}
        onRowClick={onRowClick}
        pageSize={s.config.pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        serverPagination={{
          page: page.page,
          size: page.size,
          totalElements: page.totalElements,
          totalPages: page.totalPages,
          hasNext: page.hasNext,
          hasPrevious: page.hasPrevious,
          onPageChange: (p) => s.setPage(p + 1),
          onPageSizeChange: s.changePageSize,
        }}
      />
    </>
  );
}
