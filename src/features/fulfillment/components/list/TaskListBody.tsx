"use client";

import { PackageSearch } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { isOnDesignHold } from "@/features/fulfillment/selectors";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { FulfillmentLoadError } from "../FulfillmentLoadError";
import { PAGE_SIZE_OPTIONS } from "./constants";

import type { FulfillmentTask } from "@/features/fulfillment/types";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { TaskListState } from "./useTaskListState";

const { fulfillment } = UI_LABELS;

/**
 * Vùng bảng — tách các trạng thái (api-conventions §8): tải lần đầu, lỗi tải, chưa có task,
 * trang vượt quá dữ liệu. BE chưa có lọc nên không có trạng thái "lọc không ra kết quả".
 * EmptyState không lặp lại nút tạo task — nút duy nhất nằm ở PageHeader (người dùng chốt).
 */
export function TaskListBody({
  s,
  columns,
}: {
  s: TaskListState;
  columns: ColumnDef<FulfillmentTask>[];
}) {
  const { query, scope } = s;
  const title = scope === "picking" ? fulfillment.pickingTitle : fulfillment.packingTitle;

  if (!s.canRead) return <FulfillmentLoadError inline scope={scope} error={null} kind="no-read" />;
  if (query.isError) {
    return (
      <FulfillmentLoadError
        inline
        scope={scope}
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
          scope={scope}
          error={null}
          kind="network"
          onRetry={() => void query.refetch()}
        />
      );
    }
    return <PageSkeleton variant="list" />;
  }
  if (s.emptyState === "no-tasks") {
    return (
      <EmptyState
        icon={<PackageSearch className="size-8" />}
        title="Chưa có task xuất kho"
        description="Chưa có đơn nào được đưa vào xuất kho trong phạm vi bạn được xem."
      />
    );
  }
  if (s.emptyState === "invalid-page") {
    return (
      <EmptyState
        icon={<PackageSearch className="size-8" />}
        title="Trang không còn dữ liệu"
        description="Trang hiện tại vượt quá số trang có dữ liệu."
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => void s.setPage(1)}>
            Về trang đầu
          </Button>
        }
      />
    );
  }

  const page = query.data;
  return (
    <>
      <RefetchBar active={query.isFetching} label={`Đang tải lại ${title.toLowerCase()}`} />
      <DataTable
        columns={columns}
        data={page.items}
        rowKey={(row) => row.taskId}
        caption={`Hiển thị ${page.items.length} / ${page.totalElements} task xuất kho`}
        // Kiện bị giữ do lệch thiết kế cần QC / quản lý kho xử lý (data-table-mode-a: row cần chú ý)
        flagRow={isOnDesignHold}
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
