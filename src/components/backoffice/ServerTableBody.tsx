"use client";

import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { LoadErrorState } from "./LoadErrorState";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ApiError } from "@/lib/api/error";
import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { LoadErrorCopy } from "./LoadErrorState";

export const LIST_PAGE_SIZE_OPTIONS = [10, 15, 20, 50];

interface ServerTableBodyProps<T> {
  query: UseQueryResult<PaginatedResponse<T>, ApiError | Error>;
  canRead: boolean;
  columns: ColumnDef<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  flagRow?: (row: T) => boolean;
  /** Đơn vị đếm trong caption, vd "khách hàng". */
  noun: string;
  errorCopy: LoadErrorCopy;
  hasFilters: boolean;
  onClearFilters: () => void;
  /** Chưa có dữ liệu (khác "lọc không ra") — kèm CTA nếu người dùng được tạo. */
  empty: { icon: ReactNode; title: string; description: string; action?: ReactNode };
  pageSize: number;
  onPageChange: (zeroBasedPage: number) => void;
  onPageSizeChange: (size: number) => void;
  sorting?: {
    key: string | null;
    direction: "asc" | "desc";
    onChange: (key: string, direction: "asc" | "desc") => void;
  };
  /** Bảng chính của trang danh sách (style Vercel): header dính, thân cuộn trong khung. */
  stickyHeader?: boolean;
  /**
   * Trạng thái rỗng (chưa có dữ liệu / lọc không ra / trang vượt) nằm TRONG thân bảng, giữ header và nút lọc ở
   * header cột (backoffice-erp-ui §7). Mặc định tắt để trang cũ giữ nguyên.
   */
  emptyInTable?: boolean;
  /**
   * Lọc thêm ở FE trên trang đang xem (ô tìm / lọc cột khi BE không có tham số). `active` → chú thích bảng nói rõ
   * phạm vi; trang có dòng mà không dòng nào khớp → "Không tìm thấy kết quả".
   */
  rowFilter?: { match: (row: T) => boolean; active: boolean };
}

/** EmptyState bỏ khung khi nằm trong thân bảng. */
const IN_TABLE_EMPTY_CLASS = "rounded-none border-0 bg-transparent py-10 whitespace-normal";

/**
 * Vùng bảng danh sách phân trang phía server — tách đủ trạng thái (api-conventions §8):
 * thiếu quyền đọc, lỗi tải, mất mạng, tải lần đầu, chưa có dữ liệu, lọc không ra, trang vượt.
 */
export function ServerTableBody<T>({
  query,
  canRead,
  columns,
  rowKey,
  onRowClick,
  flagRow,
  noun,
  errorCopy,
  hasFilters,
  onClearFilters,
  empty,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sorting,
  stickyHeader = false,
  emptyInTable = false,
  rowFilter,
}: ServerTableBodyProps<T>) {
  if (!canRead) return <LoadErrorState inline error={null} kind="no-read" copy={errorCopy} />;
  if (query.isError)
    return (
      <LoadErrorState
        inline
        error={query.error}
        copy={errorCopy}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.isPending) {
    if (query.fetchStatus === "paused")
      return (
        <LoadErrorState
          inline
          error={null}
          kind="network"
          copy={errorCopy}
          onRetry={() => void query.refetch()}
        />
      );
    return <PageSkeleton variant="list" />;
  }
  const page = query.data;
  const filtering = rowFilter?.active === true;
  const rows = filtering ? page.items.filter(rowFilter.match) : page.items;
  const invalidPage = page.totalElements > 0 && page.items.length === 0;
  const emptyNode =
    rows.length > 0 ? null : page.totalElements === 0 && !hasFilters ? (
      <EmptyState
        className={emptyInTable ? IN_TABLE_EMPTY_CLASS : undefined}
        icon={empty.icon}
        title={empty.title}
        description={empty.description}
        action={empty.action}
      />
    ) : (
      <EmptyState
        className={emptyInTable ? IN_TABLE_EMPTY_CLASS : undefined}
        icon={empty.icon}
        title={invalidPage ? "Trang không còn dữ liệu" : "Không tìm thấy kết quả"}
        description={
          invalidPage
            ? "Trang hiện tại vượt quá số trang có dữ liệu."
            : `Không có ${noun} nào khớp từ khoá hoặc bộ lọc hiện tại.`
        }
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => (invalidPage ? onPageChange(0) : onClearFilters())}
          >
            {invalidPage ? "Về trang đầu" : "Bỏ bộ lọc"}
          </Button>
        }
      />
    );
  if (emptyNode && !emptyInTable) return emptyNode;

  return (
    <>
      <RefetchBar active={query.isFetching} label={`Đang tải lại danh sách ${noun}`} />
      <DataTable
        columns={columns}
        data={rows}
        rowKey={rowKey}
        caption={
          filtering
            ? `Lọc trong trang đang xem: ${rows.length} / ${page.items.length} ${noun} · tổng ${page.totalElements}`
            : `Hiển thị ${page.items.length} / ${page.totalElements} ${noun}`
        }
        flagRow={flagRow}
        onRowClick={onRowClick}
        stickyHeader={stickyHeader}
        pageSize={pageSize}
        pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
        serverPagination={{
          page: page.page,
          size: page.size,
          totalElements: page.totalElements,
          totalPages: page.totalPages,
          hasNext: page.hasNext,
          hasPrevious: page.hasPrevious,
          onPageChange,
          onPageSizeChange,
        }}
        serverSorting={sorting}
        emptyState={emptyNode ?? undefined}
      />
    </>
  );
}
