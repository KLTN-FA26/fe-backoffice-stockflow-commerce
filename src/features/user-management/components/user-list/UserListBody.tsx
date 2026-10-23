"use client";

import { Users } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";
import { identityErrorMessage } from "@/lib/api/identity-errors";

import { USER_PAGE_SIZE_OPTIONS, USER_UI } from "../../constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { UserDto } from "../../types";
import type { UserListState } from "./useUserListState";

/**
 * Vùng bảng — tách rõ các trạng thái (api-conventions §8): thiếu READ, tải lần đầu, lỗi tải,
 * chưa có dữ liệu, lọc không ra kết quả. Lỗi tải không bị nuốt thành "không có dữ liệu".
 */
export function UserListBody({
  s,
  columns,
  createAction,
}: {
  s: UserListState;
  columns: ColumnDef<UserDto>[];
  createAction?: React.ReactNode;
}) {
  const { query, filters } = s;
  if (!s.canRead) return <EmptyState title="Không có quyền xem" description={USER_UI.noRead} />;
  if (query.isError) {
    return (
      <EmptyState
        title={USER_UI.loadFailed}
        description={identityErrorMessage(query.error)}
        action={
          <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>
            {USER_UI.retry}
          </Button>
        }
      />
    );
  }
  if (query.isPending) return <PageSkeleton variant="list" />;
  if (s.emptyState === "no-users") {
    return (
      <EmptyState
        icon={<Users className="size-8" />}
        title={USER_UI.emptyTitle}
        description={USER_UI.emptyDescription}
        action={createAction}
      />
    );
  }
  if (s.emptyState === "no-results" || s.emptyState === "invalid-page") {
    const invalidPage = s.emptyState === "invalid-page";
    return (
      <EmptyState
        icon={<Users className="size-8" />}
        title={invalidPage ? "Trang không còn dữ liệu" : USER_UI.noResultsTitle}
        description={
          invalidPage
            ? "Trang hiện tại vượt quá số trang có dữ liệu."
            : USER_UI.noResultsDescription
        }
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => (invalidPage ? void filters.setPage(1) : s.resetAll())}
          >
            {invalidPage ? "Về trang đầu" : USER_UI.clearFilters}
          </Button>
        }
      />
    );
  }
  const page = query.data;
  return (
    <>
      <RefetchBar active={query.isFetching} label="Đang tải lại danh sách người dùng" />
      <DataTable
        columns={columns}
        data={page.items}
        rowKey={(user) => user.userId}
        caption={`Hiển thị ${page.items.length} / ${page.totalElements} người dùng`}
        flagRow={(user) => user.status !== "ACTIVE"}
        onRowClick={s.openDetail}
        pageSize={s.size}
        pageSizeOptions={USER_PAGE_SIZE_OPTIONS}
        serverPagination={{
          page: page.page,
          size: page.size,
          totalElements: page.totalElements,
          totalPages: page.totalPages,
          hasNext: page.hasNext,
          hasPrevious: page.hasPrevious,
          onPageChange: (next) => void filters.setPage(next + 1),
          onPageSizeChange: s.changePageSize,
        }}
        serverSorting={{ key: s.sort.key, direction: s.sort.direction, onChange: s.changeSort }}
      />
    </>
  );
}
