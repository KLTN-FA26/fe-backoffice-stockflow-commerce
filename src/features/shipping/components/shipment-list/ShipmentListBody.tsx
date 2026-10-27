"use client";

import { PackageCheck } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { RefetchErrorNotice } from "../primitives";
import { ShippingLoadError } from "../ShippingLoadError";
import { PAGE_SIZE_OPTIONS } from "./constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { ShipmentRow } from "@/features/shipping/types";
import type { ShipmentListState } from "./useShipmentListState";

const E = UI_LABELS.emptyList;
const L = UI_LABELS.shipping.shipments;

/**
 * Vùng bảng — tách trạng thái (api-conventions §8): tải lần đầu, lỗi tải, chưa có lô, lọc không ra kết
 * quả. Hai loại empty là hai thông điệp khác nhau. `selectable`: chọn lô để mở chuyến (chỉ khi lọc lô chờ xuất).
 */
export function ShipmentListBody({
  s,
  columns,
  selectable,
}: {
  s: ShipmentListState;
  columns: ColumnDef<ShipmentRow>[];
  selectable: boolean;
}) {
  const { query } = s;
  // Tải lại ngầm thất bại nhưng đã có dữ liệu → báo nhỏ ở MỌI trạng thái (kể cả đang rỗng)
  return (
    <>
      {query.isError && query.data && <RefetchErrorNotice onRetry={() => void query.refetch()} />}
      <Content s={s} columns={columns} selectable={selectable} />
    </>
  );
}

function Content({
  s,
  columns,
  selectable,
}: {
  s: ShipmentListState;
  columns: ColumnDef<ShipmentRow>[];
  selectable: boolean;
}) {
  const { query } = s;
  if (!s.canRead) return <ShippingLoadError inline error={null} kind="no-read" />;
  if (query.isError && !query.data) {
    return <ShippingLoadError inline error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.isPending) {
    if (query.fetchStatus === "paused") {
      return (
        <ShippingLoadError
          inline
          error={null}
          kind="network"
          onRetry={() => void query.refetch()}
        />
      );
    }
    return <PageSkeleton variant="list" />;
  }
  if (s.emptyState === "no-shipments") {
    return (
      <EmptyState
        icon={<PackageCheck className="size-8" />}
        title={L.empty.noDataTitle}
        description={L.empty.noDataDescription}
      />
    );
  }
  if (s.emptyState === "no-results" || s.emptyState === "invalid-page") {
    const invalidPage = s.emptyState === "invalid-page";
    return (
      <EmptyState
        icon={<PackageCheck className="size-8" />}
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
      <RefetchBar active={query.isFetching} label={L.refetching} />
      <DataTable
        stickyHeader
        columns={columns}
        data={page.items}
        rowKey={(row) => row.shipmentId}
        caption={`${UI_LABELS.common.showing} ${page.items.length} / ${page.totalElements} ${L.listCaption}`}
        onRowClick={s.navigateToShipment}
        selectable={selectable}
        selectedKeys={s.selectedKeys}
        onSelectionChange={s.onSelectionChange}
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
