"use client";

import Link from "next/link";
import { FileText, Plus } from "lucide-react";

import { ADMIN_ROUTES, RECEIPT_STATUS, UI_LABELS } from "@/constants";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { ReceiptLoadError } from "../ReceiptLoadError";
import { PAGE_SIZE_OPTIONS } from "./constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { GoodsReceiptRow } from "@/features/receipt/types";
import type { ReceiptListState } from "./useReceiptListState";

/**
 * Vùng bảng — tách 4 trạng thái (api-conventions §8): tải lần đầu, lỗi tải, chưa có phiếu, lọc
 * không ra kết quả. Lỗi tải KHÔNG bị nuốt thành "Không có dữ liệu".
 */
export function ReceiptListBody({
  s,
  columns,
  canCreate,
}: {
  s: ReceiptListState;
  columns: ColumnDef<GoodsReceiptRow>[];
  canCreate: boolean;
}) {
  const { query, filters } = s;

  if (!s.canRead) return <ReceiptLoadError inline error={null} kind="no-read" />;
  if (query.isError) {
    return <ReceiptLoadError inline error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.isPending) {
    if (query.fetchStatus === "paused") {
      return (
        <ReceiptLoadError inline error={null} kind="network" onRetry={() => void query.refetch()} />
      );
    }
    return <PageSkeleton variant="list" />;
  }
  if (s.emptyState === "no-receipts") {
    return (
      <EmptyState
        icon={<FileText className="size-8" />}
        title="Chưa có phiếu nhận"
        description="Chưa có lần nhận hàng nào theo đơn đặt hàng."
        action={
          canCreate ? (
            <Button asChild size="sm" className="rounded-[var(--r-sm)]">
              <Link href={ADMIN_ROUTES.receipts.create}>
                <Plus className="size-3.5" /> Tạo phiếu nhận đầu tiên
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
        icon={<FileText className="size-8" />}
        title={invalidPage ? "Trang không còn dữ liệu" : "Không tìm thấy kết quả"}
        description={
          invalidPage
            ? "Trang hiện tại vượt quá số trang có dữ liệu."
            : "Không có phiếu nhận nào khớp từ khoá hoặc bộ lọc hiện tại."
        }
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => (invalidPage ? void filters.setPage(1) : s.clearFilters())}
          >
            {invalidPage ? "Về trang đầu" : "Bỏ bộ lọc"}
          </Button>
        }
      />
    );
  }

  const page = query.data;
  return (
    <>
      <RefetchBar
        active={query.isFetching}
        label={`Đang tải lại ${UI_LABELS.receipt.pageTitle.toLowerCase()}`}
      />
      <DataTable
        columns={columns}
        data={page.items}
        rowKey={(row) => row.id}
        caption={`Hiển thị ${page.items.length} / ${page.totalElements} phiếu nhận`}
        // Còn dòng chờ QC → chặn putaway, cần NV kho / QC xử lý (data-table-mode-a: row cần chú ý)
        flagRow={(row) => row.status === RECEIPT_STATUS.IN_QC}
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
        serverSorting={{ key: s.sort.key, direction: s.sort.direction, onChange: s.changeSort }}
      />
    </>
  );
}
