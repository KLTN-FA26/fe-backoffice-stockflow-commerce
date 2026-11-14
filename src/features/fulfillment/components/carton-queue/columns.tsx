"use client";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { CELL, dateCell, statusCell, ViewAction } from "@/components/shared/column-helpers";

import { orderLabel } from "../primitives";

import type { CartonCheckQueueRow } from "@/features/fulfillment/carton-check-types";
import type { ColumnDef } from "@/components/shared/DataTable";

const L = UI_LABELS.cartonCheck;
const COLUMNS = L.queueColumns;

export interface QueueColumnContext {
  warehouseName: (warehouseId: string | null | undefined) => string;
  selfId: string | null;
}

/** Cột hàng chờ kiểm thùng — đúng field BE `CartonCheckQueueRowResponse`. */
export function buildQueueColumns({
  warehouseName,
  selfId,
}: QueueColumnContext): ColumnDef<CartonCheckQueueRow>[] {
  return [
    {
      key: "order",
      header: COLUMNS.order,
      cell: (row) => (
        <span className={CELL.code} title={row.orderId}>
          {row.orderNumber ?? orderLabel(row.orderId, undefined)}
        </span>
      ),
    },
    {
      key: "warehouse",
      header: COLUMNS.warehouse,
      cell: (row) => <span className={CELL.name}>{warehouseName(row.warehouseId)}</span>,
    },
    dateCell<CartonCheckQueueRow>("pickedAt", COLUMNS.pickedAt, (row) => row.pickedAt, {
      withTime: true,
    }),
    {
      key: "picker",
      header: COLUMNS.picker,
      cell: (row) => <span className={CELL.name}>{row.pickerName ?? "—"}</span>,
    },
    {
      key: "starter",
      header: COLUMNS.starter,
      cell: (row) => {
        if (!row.startedBy) return <span className={CELL.empty}>{L.noStarter}</span>;
        const mine = row.startedBy === selfId;
        return (
          <span className={CELL.name}>{mine ? L.status.you : (row.startedByName ?? "—")}</span>
        );
      },
    },
    statusCell<CartonCheckQueueRow>("status", COLUMNS.status, (row) => row.status, "pack"),
    {
      key: "cartons",
      header: COLUMNS.cartons,
      cell: (row) => (
        <span className={`${CELL.text} tabular-nums`}>
          {row.cartonCount === 0
            ? "—"
            : L.cartonsCell(row.checkedCount, row.labeledCount, row.cartonCount)}
        </span>
      ),
    },
    {
      key: "shipments",
      header: COLUMNS.shipments,
      align: "right",
      cell: (row) => <span className={CELL.number}>{row.shipmentCount}</span>,
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <ViewAction
          label={`${L.openStation} ${row.orderNumber ?? orderLabel(row.orderId, undefined)}`}
          href={ADMIN_ROUTES.packing.detail(row.taskId)}
        />
      ),
    },
  ];
}
