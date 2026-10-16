"use client";

import { Truck } from "lucide-react";

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
import type { LoadRow } from "@/features/shipping/types";
import type { LoadListState } from "./useLoadListState";

const E = UI_LABELS.emptyList;

/**
 * Vùng bảng — tách trạng thái (api-conventions §8): tải lần đầu, lỗi tải, chưa có chuyến, lọc không
 * ra kết quả. Hai loại empty là hai thông điệp khác nhau.
 */
export function LoadListBody({ s, columns }: { s: LoadListState; columns: ColumnDef<LoadRow>[] }) {
  const { query } = s;
  // Tải lại ngầm thất bại nhưng đã có dữ liệu → báo nhỏ ở MỌI trạng thái (kể cả đang rỗng)
  return (
    <>
      {query.isError && query.data && <RefetchErrorNotice onRetry={() => void query.refetch()} />}
      <LoadListContent s={s} columns={columns} />
    </>
  );
}

function LoadListContent({ s, columns }: { s: LoadListState; columns: ColumnDef<LoadRow>[] }) {
  const { query, filters } = s;

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
  if (s.emptyState === "no-loads") {
    return (
      <EmptyState
        icon={<Truck className="size-8" />}
        title={UI_LABELS.shipping.empty.noDataTitle}
        description={UI_LABELS.shipping.empty.noDataDescription}
      />
    );
  }
  if (s.emptyState === "no-results" || s.emptyState === "invalid-page") {
    const invalidPage = s.emptyState === "invalid-page";
    return (
      <EmptyState
        icon={<Truck className="size-8" />}
        title={invalidPage ? E.invalidPageTitle : E.noResultsTitle}
        description={
          invalidPage ? E.invalidPageDescription : UI_LABELS.shipping.empty.noResultsDescription
        }
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => (invalidPage ? void filters.setPage(1) : s.clearFilters())}
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
      <RefetchBar active={query.isFetching} label={UI_LABELS.shipping.refetching} />
      <DataTable
        columns={columns}
        data={page.items}
        rowKey={(row) => row.loadId}
        caption={`${UI_LABELS.common.showing} ${page.items.length} / ${page.totalElements} ${UI_LABELS.shipping.listCaption}`}
        onRowClick={s.navigateToLoading}
        pageSize={s.config.pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        serverPagination={{
          page: page.page,
          size: page.size,
          totalElements: page.totalElements,
          totalPages: page.totalPages,
          hasNext: page.hasNext,
          hasPrevious: page.hasPrevious,
          onPageChange: (p) => void filters.setPage(p + 1),
          onPageSizeChange: s.changePageSize,
        }}
      />
    </>
  );
}
