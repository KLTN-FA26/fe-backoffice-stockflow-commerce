"use client";

import dynamic from "next/dynamic";

import { useSupplierSpend } from "@/features/purchase-order";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import { PoLoadError } from "../PoLoadError";
import { PAGE_SIZE_OPTIONS } from "./config";
import { SupplierSpendFilters } from "./SupplierSpendFilters";
import { spendColumns } from "./supplierSpendColumns";
import { useSupplierSpendFilters } from "./useSupplierSpendFilters";

// Chart nặng (recharts) → tách chunk, chỉ tải khi mở tab (api-conventions §9).
const SupplierSpendChart = dynamic(() => import("./SupplierSpendChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[320px] w-full" />,
});

/**
 * Chi tiêu theo NCC (`GET /purchase-orders/reports/supplier-spend`). BE #40 tách theo tiền tệ:
 * luôn lọc MỘT tiền tệ để bảng + biểu đồ không cộng/so lẫn VND với USD.
 */
export function SupplierSpendSection({ canRead }: { canRead: boolean }) {
  const f = useSupplierSpendFilters();
  const currency = f.currency;
  const spendQ = useSupplierSpend(
    {
      page: f.page,
      size: f.size,
      currency,
      expectedAtFrom: f.range.from || undefined,
      expectedAtTo: f.range.to || undefined,
    },
    { enabled: canRead },
  );
  const data = spendQ.data;

  const hasRange = f.range.from !== "" || f.range.to !== "";

  if (!canRead) return <PoLoadError error={null} kind="no-read" inline />;

  return (
    <div className="space-y-4">
      {/* key theo khoảng đang áp dụng: bỏ lọc từ EmptyState thì ô ngày nháp cũng reset. */}
      <SupplierSpendFilters
        key={`${f.range.from}|${f.range.to}`}
        currency={currency}
        range={f.range}
        onCurrencyChange={f.setCurrency}
        onApplyRange={f.setRange}
      />

      {spendQ.isError ? (
        <PoLoadError error={spendQ.error} onRetry={() => void spendQ.refetch()} inline />
      ) : !data ? (
        <Skeleton className="h-[320px] w-full" />
      ) : data.totalElements === 0 ? (
        // §8: hai loại rỗng khác nhau — lọc ngày không ra kết quả ≠ chưa có chi tiêu.
        hasRange ? (
          <EmptyState
            title="Không có chi tiêu trong khoảng ngày đã chọn"
            description={`Không có đơn ${currency} nào có ngày giao dự kiến trong khoảng này.`}
            action={
              <Button variant="outline" size="sm" onClick={() => f.setRange({ from: "", to: "" })}>
                Bỏ lọc ngày
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={`Chưa có chi tiêu bằng ${currency}`}
            description="Chỉ tính đơn đã duyệt trở đi (bỏ Nháp / Đã huỷ). Thử chọn tiền tệ khác."
          />
        )
      ) : (
        <>
          {data.items.length > 0 && (
            <SupplierSpendChart
              rows={data.items}
              currency={currency}
              rankStart={data.page * data.size + 1}
              total={data.totalElements}
            />
          )}
          <DataTable
            data={data.items}
            columns={spendColumns(currency)}
            rowKey={(r) => `${r.supplierId}|${r.currency ?? currency}`}
            pageSize={f.size}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            serverPagination={{
              page: data.page,
              size: data.size,
              totalElements: data.totalElements,
              totalPages: data.totalPages,
              hasNext: data.hasNext,
              hasPrevious: data.hasPrevious,
              onPageChange: f.setPage,
              onPageSizeChange: f.setSize,
            }}
          />
        </>
      )}
    </div>
  );
}
