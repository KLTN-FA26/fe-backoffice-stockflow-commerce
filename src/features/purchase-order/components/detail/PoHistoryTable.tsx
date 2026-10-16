"use client";

import { DataTable } from "@/components/shared/DataTable";
import { Skeleton } from "@/components/shared/Skeleton";

import { PAGE_SIZE_OPTIONS } from "../list/config";
import { PoLoadError } from "../PoLoadError";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { PoHistoryParams } from "@/features/purchase-order";
import type { ColumnDef } from "@/components/shared/DataTable";

/** Một bảng lịch sử gửi NCC (phân trang server) + đủ trạng thái tải / lỗi / rỗng (§8). */
export function HistoryTable<T extends { id: string }>({
  query,
  columns,
  empty,
  unit,
  flagRow,
  onRowClick,
  onParams,
}: {
  query: {
    data?: PaginatedResponse<T>;
    error: unknown;
    isError: boolean;
    refetch: () => unknown;
  };
  columns: ColumnDef<T>[];
  empty: string;
  unit: string;
  flagRow?: (row: T) => boolean;
  onRowClick: (row: T) => void;
  onParams: (p: PoHistoryParams) => void;
}) {
  // §8: lỗi phân loại 403 / 5xx / mất mạng + Thử lại; tải lần đầu = Skeleton đúng hình bảng.
  if (query.isError) {
    return <PoLoadError error={query.error} onRetry={() => void query.refetch()} inline />;
  }
  if (!query.data) return <HistoryTableSkeleton />;
  const page = query.data;
  if (page.totalElements === 0) return <p className="text-ink-tertiary text-xs">{empty}</p>;
  return (
    <DataTable
      data={page.items}
      columns={columns}
      rowKey={(r) => r.id}
      caption={`${page.totalElements} ${unit}`}
      flagRow={flagRow}
      onRowClick={onRowClick}
      pageSize={page.size}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      serverPagination={{
        page: page.page,
        size: page.size,
        totalElements: page.totalElements,
        totalPages: page.totalPages,
        hasNext: page.hasNext,
        hasPrevious: page.hasPrevious,
        onPageChange: (p) => onParams({ page: p, size: page.size }),
        // data-table-mode-a §5: đổi số dòng → về trang đầu
        onPageSizeChange: (size) => onParams({ page: 0, size }),
      }}
    />
  );
}

/** Skeleton đúng hình bảng lịch sử: hàng header + 3 dòng. */
function HistoryTableSkeleton() {
  return (
    <div className="space-y-1.5" aria-busy="true" aria-label="Đang tải lịch sử gửi">
      <Skeleton className="h-8 w-full" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
