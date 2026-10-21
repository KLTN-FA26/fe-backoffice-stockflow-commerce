"use client";

import { ArrowRight } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { statusCell } from "@/components/shared/column-helpers";
import { Button } from "@/components/ui/button";

import { MONO, orderLabel } from "../primitives";

import type { PackingQueueRow } from "@/features/fulfillment/packing-types";
import type { ColumnDef } from "@/components/shared/DataTable";

const L = UI_LABELS.packing;
const CELL = "text-[0.8125rem]";
const COLUMNS = L.queueColumns;

export interface QueueColumnContext {
  warehouseName: (warehouseId: string | null | undefined) => string;
  selfId: string | null;
  onOpen: (row: PackingQueueRow) => void;
}

/** Cột hàng chờ đóng gói — đúng field BE `PackingQueueRowResponse`. */
export function buildQueueColumns({
  warehouseName,
  selfId,
  onOpen,
}: QueueColumnContext): ColumnDef<PackingQueueRow>[] {
  return [
    {
      key: "order",
      header: COLUMNS.order,
      cell: (row) => (
        <span className={`text-accent font-medium ${MONO} ${CELL}`} title={row.orderId}>
          {row.orderNumber ?? orderLabel(row.orderId, undefined)}
        </span>
      ),
    },
    {
      key: "warehouse",
      header: COLUMNS.warehouse,
      cell: (row) => (
        <span className={`text-ink-primary ${CELL}`}>{warehouseName(row.warehouseId)}</span>
      ),
    },
    {
      key: "pickedAt",
      header: COLUMNS.pickedAt,
      cell: (row) => (
        <span className={`text-ink-secondary tabular-nums ${CELL}`}>
          {row.pickedAt ? formatDateTime(row.pickedAt) : "—"}
        </span>
      ),
    },
    {
      key: "picker",
      header: COLUMNS.picker,
      cell: (row) => <span className={`text-ink-primary ${CELL}`}>{row.pickerName ?? "—"}</span>,
    },
    {
      key: "packer",
      header: COLUMNS.packer,
      cell: (row) => {
        if (!row.packerId) return <span className={`text-ink-tertiary ${CELL}`}>{L.noPacker}</span>;
        const mine = row.packerId === selfId;
        return (
          <span className={`text-ink-primary ${CELL}`}>
            {mine ? L.status.you : (row.packerName ?? "—")}
          </span>
        );
      },
    },
    statusCell<PackingQueueRow>("status", COLUMNS.status, (row) => row.packStatus, "pack"),
    {
      key: "packages",
      header: COLUMNS.packages,
      cell: (row) => (
        <span className={`text-ink-secondary tabular-nums ${CELL}`}>
          {row.packageCount === 0 ? "—" : L.packagesCell(row.sealedPackageCount, row.packageCount)}
        </span>
      ),
    },
    {
      key: "shipments",
      header: COLUMNS.shipments,
      align: "right",
      cell: (row) => (
        <span className={`text-ink-primary tabular-nums ${CELL}`}>{row.shipmentCount}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(row);
          }}
          className="border-border-default bg-bg-surface rounded-[var(--r-sm)]"
        >
          {L.openStation} <ArrowRight className="size-3.5" />
        </Button>
      ),
    },
  ];
}
