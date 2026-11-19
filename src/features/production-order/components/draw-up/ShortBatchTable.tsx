"use client";

import { Plus } from "lucide-react";

import { PRODUCTION_LABELS, SHORT_BATCH_COLUMNS as C } from "@/constants";
import { formatNumber } from "@/lib/format";

import { CELL, StackText } from "@/components/shared/column-helpers";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";

import { formatWindow, shortId } from "../parts";

import type { ReactNode } from "react";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { ShortDeliveryBatch } from "@/features/production-order/schedule-schemas";

const L = PRODUCTION_LABELS.drawUp;

const batchKey = (batch: ShortDeliveryBatch) => batch.deliveryBatchId;

/**
 * Đợt giao còn thiếu chưa có Đơn sản xuất phủ (docs 17 §4.12 bước 47) — nơi Điều phối sản xuất bắt đầu lập Đơn sản
 * xuất (§4.3 bước 6). `onDrawUp` vắng khi không có quyền lập → không có cột thao tác. `extraColumns` cho lịch thêm cột
 * cờ trễ.
 */
export function ShortBatchTable({
  batches,
  onDrawUp,
  extraColumns = [],
  empty,
}: {
  batches: ShortDeliveryBatch[];
  onDrawUp?: (batch: ShortDeliveryBatch) => void;
  extraColumns?: ColumnDef<ShortDeliveryBatch>[];
  empty?: ReactNode;
}) {
  if (batches.length === 0)
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
          {row.shippingWarehouseCode ?? shortId(row.shippingWarehouseId)}
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
      header: "",
      cell: (row) => (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`${L.action} ${row.orderNumber} ${L.batch} ${row.seq}`}
            onClick={(event) => {
              event.stopPropagation();
              onDrawUp(row);
            }}
          >
            <Plus className="size-3.5" /> {L.action}
          </Button>
        </div>
      ),
    });
  return <DataTable columns={columns} data={batches} rowKey={batchKey} caption={L.title} />;
}
