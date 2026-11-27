"use client";

import { LIST_PAGE_SIZE_OPTIONS } from "@/components/backoffice/ServerTableBody";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { REVIEW_LIST_COPY as C } from "./copy";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ApiError } from "@/lib/api/error";
import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";
import type { ColumnDef } from "@/components/shared/DataTable";

/** EmptyState bỏ khung — nằm trong thân bảng, bảng và header vẫn giữ (backoffice-erp-ui A7). */
const IN_TABLE = "rounded-none border-0 bg-transparent py-10 whitespace-normal";

/**
 * Bảng danh sách phân trang phía server của màn duyệt thiết kế. Như `ServerTableBody` (thiếu quyền, lỗi, mất mạng,
 * skeleton) nhưng ba trạng thái rỗng nằm trong thân bảng để còn bỏ lọc ở cột (A7).
 *
 * BE chỉ nhận `page` / `size` → lọc ở header cột chỉ xét các dòng của trang đang xem (`matches`); chú thích bảng nói rõ
 * phạm vi đó, và phân trang vẫn theo tổng của BE.
 */
export function ReviewListTable<T>({
  query,
  columns,
  rowKey,
  onRowClick,
  noun,
  errorCopy,
  empty,
  matches,
  filtering,
  onClearFilters,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  query: UseQueryResult<PaginatedResponse<T>, ApiError | Error>;
  columns: ColumnDef<T>[];
  rowKey: (row: T) => string;
  onRowClick: (row: T) => void;
  noun: string;
  errorCopy: LoadErrorCopy;
  empty: { icon: ReactNode; title: string; description: string };
  matches: (row: T) => boolean;
  filtering: boolean;
  onClearFilters: () => void;
  pageSize: number;
  onPageChange: (zeroBasedPage: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
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
  const rows = filtering ? page.items.filter(matches) : page.items;
  const emptyState =
    page.totalElements === 0 ? (
      <EmptyState
        className={IN_TABLE}
        icon={empty.icon}
        title={empty.title}
        description={empty.description}
      />
    ) : page.items.length === 0 ? (
      <EmptyState
        className={IN_TABLE}
        icon={empty.icon}
        title={C.invalidPageTitle}
        description={C.invalidPageDescription}
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => onPageChange(0)}>
            {C.firstPage}
          </Button>
        }
      />
    ) : rows.length === 0 ? (
      <EmptyState
        className={IN_TABLE}
        icon={empty.icon}
        title={C.noResultsTitle}
        description={C.noResultsDescription(noun)}
        action={
          <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
            {C.clearFilters}
          </Button>
        }
      />
    ) : undefined;

  return (
    <>
      <RefetchBar active={query.isFetching} label={C.refetching(noun)} />
      <DataTable
        columns={columns}
        data={rows}
        rowKey={rowKey}
        caption={
          filtering
            ? C.filteredCaption(rows.length, page.items.length, page.totalElements, noun)
            : C.caption(page.items.length, page.totalElements, noun)
        }
        onRowClick={onRowClick}
        stickyHeader
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
        emptyState={emptyState}
      />
    </>
  );
}
