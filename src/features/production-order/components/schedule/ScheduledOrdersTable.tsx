"use client";

import Link from "next/link";

import { ADMIN_ROUTES, PRODUCTION_LABELS, PRODUCTION_SCHEDULE_COLUMNS as C } from "@/constants";
import { formatDate, formatNumber } from "@/lib/format";

import { daysUntil, expectedAfterNeedBy } from "@/features/production-order/schedule-selectors";

import { CELL, EmptyCell, StackText } from "@/components/shared/column-helpers";
import { DataTable } from "@/components/shared/DataTable";

import { formatWindow, ProductionStatusDot, shortId } from "../parts";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { ScheduledProductionOrder } from "@/features/production-order/schedule-schemas";

const L = PRODUCTION_LABELS.schedule;

function NeedByCell({ row, today }: { row: ScheduledProductionOrder; today: string }) {
  const days = daysUntil(row.needByDate, today);
  return (
    <StackText
      main={<span className="tabular-nums">{formatDate(row.needByDate)}</span>}
      sub={
        <span className={days < 0 ? "text-danger" : undefined}>
          {days < 0 ? L.overdue(-days) : L.dueIn(days)}
        </span>
      }
    />
  );
}

function columns(today: string): ColumnDef<ScheduledProductionOrder>[] {
  const col = L.column;
  return [
    {
      key: C.CODE,
      header: col.code,
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.productionOrders.detail(row.id)}
          className={`${CELL.code} hover:underline`}
        >
          {row.code}
        </Link>
      ),
    },
    {
      key: C.PRODUCER,
      header: col.producer,
      cell: (row) => <StackText main={row.producerName} sub={row.producerCode} />,
    },
    {
      key: C.ORDER,
      header: col.order,
      cell: (row) => (
        <StackText
          main={
            <Link
              href={ADMIN_ROUTES.orders.detail(row.salesOrderId)}
              className={`${CELL.ref} hover:underline`}
            >
              {row.orderNumber}
            </Link>
          }
          sub={`${PRODUCTION_LABELS.drawUp.batch} ${row.deliveryBatchSeq}`}
        />
      ),
    },
    {
      key: C.WINDOW,
      header: col.window,
      cell: (row) => (
        <span className={CELL.date}>{formatWindow(row.windowStart, row.windowEnd)}</span>
      ),
    },
    {
      key: C.WAREHOUSE,
      header: col.warehouse,
      cell: (row) => (
        <span className={CELL.ref}>
          {row.receivingWarehouseCode ?? shortId(row.receivingWarehouseId)}
        </span>
      ),
    },
    { key: C.NEED_BY, header: col.needBy, cell: (row) => <NeedByCell row={row} today={today} /> },
    {
      key: C.EXPECTED,
      header: col.expected,
      cell: (row) =>
        row.expectedCompletionDate ? (
          // AT_RISK: ngày dự kiến muộn hơn ngày cần hàng (docs 17 §4.12 bước 48)
          <span
            className={`${CELL.date} ${expectedAfterNeedBy(row) ? "text-warning font-medium" : ""}`}
          >
            {formatDate(row.expectedCompletionDate)}
          </span>
        ) : (
          <EmptyCell />
        ),
    },
    {
      key: C.CARTONS,
      header: col.cartons,
      align: "right",
      cell: (row) => (
        <span className={CELL.number}>
          {formatNumber(row.receivedCartons)} / {formatNumber(row.cartons)}
        </span>
      ),
    },
    {
      key: C.STATUS,
      header: col.status,
      cell: (row) => <ProductionStatusDot status={row.status} />,
    },
  ];
}

/** Đơn sản xuất đang mở của lịch (docs 17 §4.12 bước 47), đã xếp theo ngày cần hàng; cờ trễ ở cột cuối (bước 49). */
export function ScheduledOrdersTable({
  rows,
  today,
}: {
  rows: ScheduledProductionOrder[];
  today: string;
}) {
  if (rows.length === 0)
    return <p className="text-ink-tertiary py-6 text-center text-sm">{L.ordersEmpty}</p>;
  return (
    <DataTable
      columns={columns(today)}
      data={rows}
      rowKey={(row) => row.id}
      caption={`${L.ordersTitle}: ${rows.length}`}
      flagRow={(row) => row.alerts.length > 0}
    />
  );
}
