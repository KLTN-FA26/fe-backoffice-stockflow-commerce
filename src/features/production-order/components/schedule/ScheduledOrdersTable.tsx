"use client";

import { PRODUCTION_LABELS } from "@/constants";

import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";
import { DataTable } from "@/components/shared/DataTable";

import { scheduledOrderColumns } from "./scheduled-order-columns";

import type { ReactNode } from "react";
import type { ScheduledProductionOrder } from "@/features/production-order/schedule-schemas";

const L = PRODUCTION_LABELS.schedule;

/**
 * Đơn sản xuất đang mở của lịch (docs 17 §4.12 bước 47), đã xếp theo ngày cần hàng; cờ trễ ở cột cuối (bước 49).
 * Header luôn hiện (cả khi rỗng) để còn chỉnh bộ lọc trong cột.
 */
export function ScheduledOrdersTable({
  rows,
  today,
  empty,
  headerFilters,
  visibleColumns,
}: {
  rows: ScheduledProductionOrder[];
  today: string;
  /** Hiện khi không có dòng — bên gọi chọn loại empty (chưa có dữ liệu / lọc không ra). */
  empty: ReactNode;
  /** Nút lọc trên header theo key cột (`PRODUCTION_SCHEDULE_COLUMNS`). */
  headerFilters?: Partial<Record<string, ReactNode>>;
  /** Key cột đang hiện (vắng = hiện hết). */
  visibleColumns?: readonly string[];
}) {
  const columns = scheduledOrderColumns(today).filter(
    (col) => !visibleColumns || visibleColumns.includes(col.key),
  );
  return (
    <DataTable
      columns={withHeaderFilters(columns, headerFilters)}
      data={rows}
      rowKey={(row) => row.id}
      caption={`${L.ordersTitle}: ${rows.length}`}
      flagRow={(row) => row.alerts.length > 0}
      emptyState={empty}
    />
  );
}
