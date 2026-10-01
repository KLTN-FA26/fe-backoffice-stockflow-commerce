"use client";

import { Plus, Truck } from "lucide-react";
import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { SupplierLoadError } from "../SupplierLoadError";
import { PAGE_SIZE_OPTIONS } from "./constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { SupplierDto } from "@/features/supplier/types";
import type { SupplierListState } from "./useSupplierListState";

/**
 * Vùng bảng — tách rõ 4 trạng thái (api-conventions §8): tải lần đầu, lỗi tải, chưa có dữ liệu,
 * lọc không ra kết quả. Lỗi tải KHÔNG bị nuốt thành "Không có dữ liệu".
 */
export function SupplierListBody({
  s,
  columns,
  canCreate,
  selectable,
  selectedKeys,
  onSelectionChange,
}: {
  s: SupplierListState;
  columns: ColumnDef<SupplierDto>[];
  canCreate: boolean;
  selectable: boolean;
  selectedKeys: Set<string>;
  onSelectionChange: (keys: Set<string>) => void;
}) {
  const { query, filters } = s;

  // Thiếu READ: query đã tắt (không gọi API) — báo rõ thay vì skeleton vô hạn
  if (!s.canRead) return <SupplierLoadError inline error={null} kind="no-read" />;
  if (query.isError) {
    return <SupplierLoadError inline error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.isPending) {
    if (query.fetchStatus === "paused") {
      return (
        <SupplierLoadError
          inline
          error={null}
          kind="network"
          onRetry={() => void query.refetch()}
        />
      );
    }
    return <PageSkeleton variant="list" />;
  }
  if (s.emptyState === "no-suppliers") {
    return (
      <EmptyState
        icon={<Truck className="size-8" />}
        title="Chưa có nhà cung cấp"
        description="Hệ thống chưa có hồ sơ nhà cung cấp nào."
        action={
          canCreate ? (
            <Button asChild size="sm" className="rounded-[var(--r-sm)]">
              <Link href={ADMIN_ROUTES.suppliers.create}>
                <Plus className="size-3.5" /> Tạo nhà cung cấp đầu tiên
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
        icon={<Truck className="size-8" />}
        title={invalidPage ? "Trang không còn dữ liệu" : "Không tìm thấy kết quả"}
        description={
          invalidPage
            ? "Trang hiện tại vượt quá số trang có dữ liệu."
            : "Không có nhà cung cấp nào khớp từ khoá hoặc bộ lọc hiện tại."
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
      <RefetchBar active={query.isFetching} label="Đang tải lại danh sách nhà cung cấp" />
      <DataTable
        columns={columns}
        data={page.items}
        rowKey={(row) => row.supplierId}
        caption={`Hiển thị ${page.items.length} / ${page.totalElements} nhà cung cấp`}
        flagRow={(row) => row.status === "Inactive"}
        onRowClick={s.navigateToDetail}
        selectable={selectable}
        selectedKeys={selectedKeys}
        onSelectionChange={onSelectionChange}
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
