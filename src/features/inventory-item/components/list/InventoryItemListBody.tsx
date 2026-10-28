"use client";

import { PackageSearch } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { classifyLoadError } from "@/lib/api/load-error";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { PAGE_SIZE_OPTIONS } from "./constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { InventoryItemSummary } from "@/features/inventory-item/types";
import type { InventoryItemListState } from "./useInventoryItemListState";

const { inventoryItem: L, loadError, common } = UI_LABELS;
const icon = <PackageSearch className="size-8" />;

const ERROR_COPY = {
  "invalid-data": [loadError.invalidDataTitle, loadError.invalidDataDescription],
  network: [loadError.networkTitle, loadError.networkDescription],
  forbidden: [loadError.forbiddenTitle, loadError.noReadTitle],
} as const;

/**
 * Vùng bảng — tách rõ các trạng thái (api-conventions §8): tải lần đầu, lỗi tải, chưa có dữ liệu,
 * lọc không ra kết quả, trang vượt quá dữ liệu. Lỗi tải KHÔNG bị nuốt thành "không có dữ liệu".
 */
export function InventoryItemListBody({
  s,
  columns,
}: {
  s: InventoryItemListState;
  columns: ColumnDef<InventoryItemSummary>[];
}) {
  const { query, filters } = s;
  const retry = (
    <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
      {common.retry}
    </Button>
  );

  // Thiếu READ: query đã tắt (không gọi API) — báo rõ thay vì skeleton vô hạn
  if (!s.canRead) return <EmptyState icon={icon} title={loadError.noReadTitle} />;
  if (query.isError) {
    const kind = classifyLoadError(query.error);
    const [title, description] =
      kind === "invalid-data" || kind === "network" || kind === "forbidden"
        ? ERROR_COPY[kind]
        : [loadError.serverTitle, loadError.serverDescription];
    return <EmptyState icon={icon} title={title} description={description} action={retry} />;
  }
  if (query.isPending) {
    if (query.fetchStatus === "paused") {
      return (
        <EmptyState
          icon={icon}
          title={loadError.networkTitle}
          description={loadError.networkDescription}
          action={retry}
        />
      );
    }
    return <PageSkeleton variant="list" />;
  }
  if (s.emptyState === "no-items") {
    return <EmptyState icon={icon} title={L.empty.noItems} description={L.empty.noItemsHint} />;
  }
  if (s.emptyState === "no-results") {
    return (
      <EmptyState
        icon={icon}
        title={L.empty.noResults}
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => filters.reset()}>
            {L.empty.clearFilters}
          </Button>
        }
      />
    );
  }
  if (s.emptyState === "invalid-page") {
    return (
      <EmptyState
        icon={icon}
        title={L.invalidPage}
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => void filters.setPage(1)}>
            {L.empty.firstPage}
          </Button>
        }
      />
    );
  }

  const page = query.data;
  return (
    <>
      {/* Đổi trang/lọc: giữ dữ liệu cũ (keepPreviousData) + thanh mảnh báo đang tải lại (§8) */}
      <RefetchBar active={query.isFetching} label={L.listRefetching} />
      <DataTable
        stickyHeader
        columns={columns}
        data={page.items}
        rowKey={(row) => row.id}
        caption={L.listCaption(page.items.length, page.totalElements)}
        // SKU chưa cấu hình chính sách tồn cần chú ý
        flagRow={(row) => !row.policyConfigured}
        onRowClick={s.navigateToDetail}
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
