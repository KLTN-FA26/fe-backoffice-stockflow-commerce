"use client";

import { ClipboardList } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { shouldFlagOrderRow } from "../../selectors";
import { OrderLoadError } from "../OrderLoadError";
import { OrderTableSkeleton } from "../OrderSkeletons";

import { PAGE_SIZE_OPTIONS } from "./constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { Order } from "../../types";
import type { OrderListState } from "./useOrderListState";

/**
 * Vùng bảng — tách rõ 4 trạng thái (api-conventions §8): tải lần đầu, lỗi tải, chưa có dữ liệu,
 * lọc không ra kết quả. Lỗi tải KHÔNG bị nuốt thành "Không có dữ liệu".
 */
export function OrderListBody({ s, columns }: { s: OrderListState; columns: ColumnDef<Order>[] }) {
  const { query, filters } = s;

  // Thiếu READ: query đã tắt (không gọi API) — báo rõ thay vì skeleton vô hạn
  if (!s.canRead) return <OrderLoadError inline error={null} kind="no-read" />;
  if (query.isError) {
    return <OrderLoadError inline error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.isPending) return <OrderTableSkeleton />;

  if (s.emptyState === "no-orders") {
    return (
      <EmptyState
        icon={<ClipboardList className="size-8" />}
        title="Chưa có đơn hàng"
        description="Hệ thống chưa ghi nhận đơn hàng nào."
      />
    );
  }
  if (s.emptyState === "no-results" || s.emptyState === "invalid-page") {
    const invalidPage = s.emptyState === "invalid-page";
    return (
      <EmptyState
        icon={<ClipboardList className="size-8" />}
        title={invalidPage ? "Trang không còn dữ liệu" : "Không tìm thấy kết quả"}
        description={
          invalidPage
            ? "Trang hiện tại vượt quá số trang có dữ liệu."
            : "Không có đơn hàng nào khớp từ khoá hoặc bộ lọc hiện tại."
        }
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => (invalidPage ? void filters.setPage(1) : filters.reset())}
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
      {/* Đổi trang/lọc: giữ dữ liệu cũ (keepPreviousData) + thanh mảnh báo đang tải lại (§8) */}
      <RefetchBar active={query.isFetching} label="Đang tải lại danh sách đơn hàng" />
      <DataTable
        columns={columns}
        data={page.items}
        rowKey={(row) => row.orderId}
        // Có caption thì footer (chọn số dòng + "Hiển thị x–y / tổng") luôn hiện, kể cả khi chỉ 1
        // trang — DataTable bỏ qua nội dung caption ở chế độ serverPagination.
        caption={`Hiển thị ${page.items.length} / ${page.totalElements} đơn hàng`}
        flagRow={shouldFlagOrderRow}
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
