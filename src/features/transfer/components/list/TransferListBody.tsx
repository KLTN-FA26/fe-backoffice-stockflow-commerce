"use client";

import Link from "next/link";
import { ArrowRightLeft, Plus } from "lucide-react";

import { ADMIN_ROUTES, TRANSFER_STATUS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { RefetchErrorNotice } from "../primitives";
import { TransferLoadError } from "../TransferLoadError";
import { InvalidParamsState } from "./InvalidParamsState";
import { PAGE_SIZE_OPTIONS } from "./constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { TransferOrderRow } from "@/features/transfer/types";
import type { TransferListState } from "./useTransferListState";

const E = UI_LABELS.emptyList;

/**
 * Vùng bảng — tách trạng thái (api-conventions §8): tải lần đầu, lỗi tải, chưa có lệnh, lọc không
 * ra kết quả. Hai loại empty là hai thông điệp khác nhau.
 */
export function TransferListBody({
  s,
  columns,
  canCreate,
}: {
  s: TransferListState;
  columns: ColumnDef<TransferOrderRow>[];
  canCreate: boolean;
}) {
  const { query, filters } = s;

  if (!s.canRead) return <TransferLoadError inline error={null} kind="no-read" />;
  if (query.isError && !query.data) {
    // 400 = tham số URL sai — "không tìm thấy lệnh" sai nghĩa và không có lối ra
    if (query.error instanceof ApiError && query.error.status === 400) {
      return <InvalidParamsState s={s} />;
    }
    return <TransferLoadError inline error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.isPending) {
    if (query.fetchStatus === "paused") {
      return (
        <TransferLoadError
          inline
          error={null}
          kind="network"
          onRetry={() => void query.refetch()}
        />
      );
    }
    return <PageSkeleton variant="list" />;
  }
  if (s.emptyState === "no-transfers") {
    return (
      <EmptyState
        icon={<ArrowRightLeft className="size-8" />}
        title={UI_LABELS.transfer.empty.noDataTitle}
        description={UI_LABELS.transfer.empty.noDataDescription}
        action={
          canCreate ? (
            <Button asChild size="sm" className="rounded-[var(--r-sm)]">
              <Link href={ADMIN_ROUTES.transfers.create}>
                <Plus className="size-3.5" /> {UI_LABELS.transfer.empty.noDataAction}
              </Link>
            </Button>
          ) : undefined
        }
      />
    );
  }
  if (s.emptyState === "no-results" || s.emptyState === "invalid-page") {
    const invalidPage = s.emptyState === "invalid-page";
    return (
      <EmptyState
        icon={<ArrowRightLeft className="size-8" />}
        title={invalidPage ? E.invalidPageTitle : E.noResultsTitle}
        description={
          invalidPage ? E.invalidPageDescription : UI_LABELS.transfer.empty.noResultsDescription
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
      {query.isError && <RefetchErrorNotice onRetry={() => void query.refetch()} />}
      <RefetchBar active={query.isFetching} label={UI_LABELS.transfer.refetching} />
      <DataTable
        columns={columns}
        data={page.items}
        rowKey={(row) => row.transferId}
        caption={`${UI_LABELS.common.showing} ${page.items.length} / ${page.totalElements} ${UI_LABELS.transfer.listCaption}`}
        // Nhận thiếu ở kho đích → chênh lệch cần xử lý (BR-05 docs 10 §6)
        flagRow={(row) => row.status === TRANSFER_STATUS.PARTIALLY_RECEIVED}
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
