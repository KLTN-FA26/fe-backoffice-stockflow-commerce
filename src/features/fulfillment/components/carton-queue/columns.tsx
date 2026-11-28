"use client";

import { cartonCheckHoldReasonLabel, UI_LABELS } from "@/constants";
import { CELL, dateCell, ViewAction } from "@/components/shared/column-helpers";
import { StatusDot } from "@/components/shared/StatusDot";

import { orderLabel } from "../primitives";

import type { CartonCheckQueueRow } from "@/features/fulfillment/carton-check-types";
import type { ColumnDef } from "@/components/shared/DataTable";

const L = UI_LABELS.cartonCheck;
const COLUMNS = L.queueColumns;

export interface QueueColumnContext {
  selfId: string | null;
  /** Link trạm kiểm thùng — trong tab theo kho (`WORKSPACE_PATHS.packingTask`). */
  detailHref: (taskId: string) => string;
}

/** Đơn đang treo (WF4-K2) vẫn nằm trong hàng chờ nhưng làm mờ — mở trạm vẫn quét kiểm được. */
const HELD_DIM = "opacity-60";
const dim = (row: CartonCheckQueueRow) => (row.holdReason ? HELD_DIM : undefined);

/** Cột hàng chờ kiểm thùng — đúng field BE `CartonCheckQueueRowResponse`. */
export function buildQueueColumns({
  selfId,
  detailHref,
}: QueueColumnContext): ColumnDef<CartonCheckQueueRow>[] {
  return [
    {
      key: "order",
      header: COLUMNS.order,
      cell: (row) => (
        <span className={`${CELL.code} ${dim(row) ?? ""}`} title={row.orderId}>
          {row.orderNumber ?? orderLabel(row.orderId, undefined)}
        </span>
      ),
    },
    dateCell<CartonCheckQueueRow>("pickedAt", COLUMNS.pickedAt, (row) => row.pickedAt, {
      withTime: true,
    }),
    {
      key: "picker",
      header: COLUMNS.picker,
      cell: (row) => (
        <span className={`${CELL.name} ${dim(row) ?? ""}`}>{row.pickerName ?? "—"}</span>
      ),
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
    {
      key: "status",
      header: COLUMNS.status,
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className={dim(row)}>
            <StatusDot domain="pack" status={row.status} size="sm" />
          </span>
          {row.holdReason && (
            <span className="text-warning text-xs">
              {L.hold.queueBadge(cartonCheckHoldReasonLabel(row.holdReason))}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "cartons",
      header: COLUMNS.cartons,
      cell: (row) => (
        <span className={`${CELL.text} tabular-nums ${dim(row) ?? ""}`}>
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
      header: "Thao tác",
      align: "right",
      className: "w-20",
      cell: (row) => (
        <ViewAction
          label={`${L.openStation} ${row.orderNumber ?? orderLabel(row.orderId, undefined)}`}
          href={detailHref(row.taskId)}
        />
      ),
    },
  ];
}
