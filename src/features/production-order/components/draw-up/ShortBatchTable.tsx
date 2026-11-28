"use client";

import { Plus } from "lucide-react";

import {
  ORDER_SHIPPING_WAREHOUSE_LABELS,
  PRODUCTION_LABELS,
  SHORT_BATCH_COLUMNS as C,
} from "@/constants";
import { formatNumber } from "@/lib/format";

import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";
import { CELL, StackText } from "@/components/shared/column-helpers";
import { DataTable } from "@/components/shared/DataTable";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";

import { formatWindow, shortId } from "../parts";

import type { ReactNode } from "react";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { ShortDeliveryBatch } from "@/features/production-order/schedule-schemas";

const L = PRODUCTION_LABELS.drawUp;

const batchKey = (batch: ShortDeliveryBatch) => batch.deliveryBatchId;

/**
 * Đợt giao còn thiếu chưa có Đơn sản xuất phủ (docs 17 §4.12 bước 47) — nơi Điều phối sản xuất bắt đầu lập Đơn sản
 * xuất (§4.3 bước 6). `onDrawUp` vắng khi không có quyền lập → không có cột thao tác. `extraColumns` cho lịch thêm cột
 * cờ trễ; `headerFilters` cho lịch gắn nút lọc trên header — khi có, header luôn hiện (cả khi rỗng) để còn chỉnh lọc.
 */
export function ShortBatchTable({
  batches,
  onDrawUp,
  extraColumns = [],
  empty,
  headerFilters,
  stickyHeader,
}: {
  batches: ShortDeliveryBatch[];
  onDrawUp?: (batch: ShortDeliveryBatch) => void;
  extraColumns?: ColumnDef<ShortDeliveryBatch>[];
  empty?: ReactNode;
  /** Nút lọc trên header theo key cột (`SHORT_BATCH_COLUMNS`). */
  headerFilters?: Partial<Record<string, ReactNode>>;
  /** Bảng chính của trang (lịch) → header dính, thân cuộn trong khung. */
  stickyHeader?: boolean;
}) {
  if (batches.length === 0 && !headerFilters)
    return empty ?? <p className="text-ink-tertiary py-6 text-center text-sm">{L.empty}</p>;
  const columns: ColumnDef<ShortDeliveryBatch>[] = [
    {
      key: C.ORDER,
      header: L.orderNumber,
      cell: (row) => (
        <StackText
          main={<span className={CELL.code}>{row.orderNumber}</span>}
          sub={`${L.batch} ${row.seq}`}
        />
      ),
    },
    {
      key: C.WINDOW,
      header: L.window,
      cell: (row) => (
        <span className={CELL.date}>{formatWindow(row.windowStart, row.windowEnd)}</span>
      ),
    },
    {
      key: C.WAREHOUSE,
      header: L.warehouse,
      cell: (row) => (
        <span className={CELL.ref}>
          {row.shippingWarehouseCode ??
            (row.shippingWarehouseId
              ? shortId(row.shippingWarehouseId)
              : ORDER_SHIPPING_WAREHOUSE_LABELS.card.none)}
        </span>
      ),
    },
    {
      key: C.SHORT,
      header: L.shortCartons,
      align: "right",
      cell: (row) => <span className={CELL.number}>{formatNumber(row.shortCartons)}</span>,
    },
    {
      key: C.LINES,
      header: L.lines,
      cell: (row) => (
        <span className={CELL.ref}>
          {row.lines.map((line) => `${line.sku} × ${line.cartons}`).join(", ")}
        </span>
      ),
    },
    ...extraColumns,
  ];
  if (onDrawUp)
    columns.push({
      key: C.ACTION,
      header: "Thao tác",
      align: "right",
      className: "w-20",
      cell: (row) => (
        <RowActionsMenu
          label={`Thao tác — ${row.orderNumber} ${L.batch} ${row.seq}`}
          actions={[{ label: L.dialogTitle, icon: Plus, onSelect: () => onDrawUp(row) }]}
        />
      ),
    });
  return (
    <DataTable
      columns={withHeaderFilters(columns, headerFilters)}
      data={batches}
      rowKey={batchKey}
      caption={L.title}
      emptyState={empty}
      stickyHeader={stickyHeader}
    />
  );
}
