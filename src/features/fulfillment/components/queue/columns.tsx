"use client";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { CELL, dateCell, statusCell, ViewAction } from "@/components/shared/column-helpers";

import { orderLabel } from "../primitives";

import type { PackingQueueRow } from "@/features/fulfillment/packing-types";
import type { ColumnDef } from "@/components/shared/DataTable";

const L = UI_LABELS.packing;
const COLUMNS = L.queueColumns;

export interface QueueColumnContext {
  warehouseName: (warehouseId: string | null | undefined) => string;
  selfId: string | null;
}

/** Cột hàng chờ đóng gói — đúng field BE `PackingQueueRowResponse`. */
export function buildQueueColumns({
  warehouseName,
  selfId,
}: QueueColumnContext): ColumnDef<PackingQueueRow>[] {
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
    dateCell<PackingQueueRow>("pickedAt", COLUMNS.pickedAt, (row) => row.pickedAt, {
      withTime: true,
    }),
    {
      key: "picker",
      header: COLUMNS.picker,
      cell: (row) => <span className={CELL.name}>{row.pickerName ?? "—"}</span>,
    },
    {
      key: "packer",
      header: COLUMNS.packer,
      cell: (row) => {
        if (!row.packerId) return <span className={CELL.empty}>{L.noPacker}</span>;
        const mine = row.packerId === selfId;
        return <span className={CELL.name}>{mine ? L.status.you : (row.packerName ?? "—")}</span>;
      },
    },
    statusCell<PackingQueueRow>("status", COLUMNS.status, (row) => row.packStatus, "pack"),
    {
      key: "packages",
      header: COLUMNS.packages,
      cell: (row) => (
        <span className={`${CELL.text} tabular-nums`}>
          {row.packageCount === 0 ? "—" : L.packagesCell(row.sealedPackageCount, row.packageCount)}
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
