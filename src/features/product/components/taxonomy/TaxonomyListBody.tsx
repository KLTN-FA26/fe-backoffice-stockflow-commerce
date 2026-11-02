"use client";

import { FolderTree } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { taxonomyErrorMessage } from "../../taxonomy-errors";
import { TAXONOMY_PAGE_SIZES } from "./useTaxonomyListState";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { TaxonomyListState } from "./useTaxonomyListState";

const L = UI_LABELS.taxonomy;
const icon = <FolderTree className="size-8" />;

/**
 * Vùng bảng của một tab — đủ trạng thái (api-conventions §8): không quyền đọc, lỗi tải, tải lần
 * đầu, chưa có dữ liệu, lọc không ra (hai EmptyState khác nhau), bảng + phân trang phía BE.
 */
export function TaxonomyListBody<T>({
  s,
  query,
  columns,
  rowKey,
  onRowClick,
  noun,
  emptyTitle,
  emptyDescription,
}: {
  s: TaxonomyListState;
  query: UseQueryResult<PaginatedResponse<T>>;
  columns: ColumnDef<T>[];
  rowKey: (row: T) => string;
  onRowClick: (row: T) => void;
  /** "thương hiệu" / "danh mục" — dùng trong caption và thanh tải lại. */
  noun: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const page = query.data;
  if (!s.canRead) return <EmptyState icon={icon} title={UI_LABELS.loadError.noReadTitle} />;
  if (query.isError) {
    return (
      <EmptyState
        icon={icon}
        title={UI_LABELS.loadError.serverTitle}
        description={taxonomyErrorMessage(query.error)}
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
            {UI_LABELS.common.retry}
          </Button>
        }
      />
    );
  }
  if (!page) return <PageSkeleton variant="list" />;
  if (page.totalElements === 0) {
    return s.filtered ? (
      <EmptyState
        icon={icon}
        title={L.noMatchTitle}
        description={L.noMatchDescription}
        action={
          <Button type="button" variant="outline" size="sm" onClick={s.resetFilters}>
            {L.clearFilters}
          </Button>
        }
      />
    ) : (
      <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />
    );
  }
  return (
    <>
      <RefetchBar active={query.isFetching} label={`Đang tải lại ${noun}`} />
      <DataTable
        stickyHeader
        columns={columns}
        data={page.items}
        rowKey={rowKey}
        caption={`Hiển thị ${page.items.length} / ${page.totalElements} ${noun}`}
        onRowClick={onRowClick}
        pageSize={s.config.pageSize}
        pageSizeOptions={TAXONOMY_PAGE_SIZES}
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
