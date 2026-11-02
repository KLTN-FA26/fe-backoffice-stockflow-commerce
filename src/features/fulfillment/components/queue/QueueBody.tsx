"use client";

import { PackageSearch } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { FulfillmentLoadError } from "../FulfillmentLoadError";
import { shortId } from "../../selectors";
import { buildQueueColumns } from "./columns";
import { PAGE_SIZE_OPTIONS } from "./constants";

import type { PackingQueueRow } from "../../packing-types";
import type { PackingQueueState } from "./usePackingQueueState";

const L = UI_LABELS.packing;

/**
 * Vùng bảng hàng chờ — tách các trạng thái (api-conventions §8): tải lần đầu, lỗi tải, chưa có đơn,
 * bộ lọc không ra kết quả, trang vượt quá dữ liệu.
 */
export function QueueBody({ s, selfId }: { s: PackingQueueState; selfId: string | null }) {
  const { data: warehouses } = useWarehouseDirectory();
  const { query } = s;
  const warehouseName = (id: string | null | undefined) =>
    id ? (warehouses?.find((w) => w.warehouseId === id)?.name ?? shortId(id)) : "—";

  if (!s.canRead)
    return <FulfillmentLoadError inline scope="packing" error={null} kind="no-read" />;
  if (query.isError && !query.data) {
    return (
      <FulfillmentLoadError
        inline
        scope="packing"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.isPending) {
    if (query.fetchStatus === "paused") {
      return (
        <FulfillmentLoadError
          inline
          scope="packing"
          error={null}
          kind="network"
          onRetry={() => void query.refetch()}
        />
      );
    }
    return <PageSkeleton variant="list" />;
  }
  if (s.emptyState === "no-orders" || s.emptyState === "no-match") {
    return (
      <EmptyState
        icon={<PackageSearch className="size-8" />}
        title={s.emptyState === "no-match" ? UI_LABELS.emptyList.noResultsTitle : L.emptyTitle}
        description={L.emptyDescription}
        action={
          s.emptyState === "no-match" ? (
            <Button type="button" variant="outline" size="sm" onClick={s.clearFilters}>
              {L.clearFilters}
            </Button>
          ) : undefined
        }
      />
    );
  }
  if (s.emptyState === "invalid-page") {
    return (
      <EmptyState
        icon={<PackageSearch className="size-8" />}
        title={UI_LABELS.emptyList.invalidPageTitle}
        description={UI_LABELS.emptyList.invalidPageDescription}
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => void s.setPage(1)}>
            {UI_LABELS.emptyList.firstPage}
          </Button>
        }
      />
    );
  }

  const page = query.data;
  const columns = buildQueueColumns({ warehouseName, selfId });
  return (
    <>
      <RefetchBar active={query.isFetching} label={L.refetching} />
      <DataTable<PackingQueueRow>
        stickyHeader
        columns={columns}
        data={page.items}
        rowKey={(row) => row.taskId}
        caption={`${UI_LABELS.common.showing} ${page.items.length} / ${page.totalElements} ${L.queueCaption}`}
        // Phiên đang bị giữ do lệch thiết kế cần QC / quản lý kho xử lý (data-table-mode-a: row cần chú ý)
        flagRow={(row) => row.packStatus === "On Hold"}
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
          onPageChange: (p) => void s.setPage(p + 1),
          onPageSizeChange: s.changePageSize,
        }}
      />
    </>
  );
}
