"use client";

import { CARTON_LIST_COLUMNS as C, CARTON_LIST_LABELS as L } from "@/constants";
import { stockStatusDisplay } from "@/constants/inventory";
import { formatDateTime, formatNumber } from "@/lib/format";

import { CELL, EmptyCell, StackText, ViewAction } from "@/components/shared/column-helpers";
import { CopyButton } from "@/components/shared/CopyButton";
import { StatusDot } from "@/components/shared/StatusDot";

import { LocationCell, OpenTaskCell, packageStatusDisplay, SourceCell } from "./carton-cells";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { CartonRow } from "@/features/inventory/quarantine-types";

const H = L.column;

/** Cột màn Thùng hàng; `sortable` ứng với `sort` của BE (`CARTON_SORT_KEYS` ở màn). */
export function cartonColumns(onOpen: (row: CartonRow) => void): ColumnDef<CartonRow>[] {
  return [
    {
      key: C.LPN,
      header: H.lpn,
      sortable: true,
      cell: (row) => (
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(row);
            }}
            className={`${CELL.code} hover:underline`}
          >
            {row.lpn}
          </button>
          <CopyButton value={row.lpn} />
        </span>
      ),
    },
    {
      key: C.PRODUCT,
      header: H.product,
      sortable: true,
      cell: (row) => (
        <StackText
          main={row.variantName ?? row.productName ?? row.sku}
          sub={<span className="font-[family-name:var(--font-mono)]">{row.sku}</span>}
        />
      ),
    },
    {
      key: C.WAREHOUSE,
      header: H.warehouse,
      cell: (row) =>
        row.warehouseCode ? <span className={CELL.ref}>{row.warehouseCode}</span> : <EmptyCell />,
    },
    {
      key: C.LOCATION,
      header: H.location,
      sortable: true,
      cell: (row) => <LocationCell row={row} />,
    },
    {
      key: C.LOT,
      header: H.lot,
      cell: (row) =>
        row.lotNumber ? <span className={CELL.ref}>{row.lotNumber}</span> : <EmptyCell />,
    },
    {
      key: C.QTY,
      header: H.qty,
      align: "right",
      cell: (row) => (
        <span className={CELL.number}>
          {formatNumber(row.onHand)} / {formatNumber(row.nominalQty)}
        </span>
      ),
    },
    {
      key: C.RESERVED,
      header: H.reserved,
      align: "right",
      cell: (row) => (
        <StackText
          main={<span className="tabular-nums">{formatNumber(row.reserved)}</span>}
          sub={row.heldFor.length > 0 ? L.heldFor(row.heldFor.length) : undefined}
        />
      ),
    },
    {
      key: C.STATUS,
      header: H.status,
      cell: (row) => <StatusDot domain="stock" status={packageStatusDisplay(row.status)} />,
    },
    {
      key: C.STOCK_STATUS,
      header: H.stockStatus,
      cell: (row) =>
        row.stockStatuses.length === 0 ? (
          <EmptyCell />
        ) : (
          <span className="flex flex-col gap-0.5">
            {row.stockStatuses.map((status) => (
              <StatusDot key={status} domain="stock" status={stockStatusDisplay(status)} />
            ))}
          </span>
        ),
    },
    {
      key: C.RECEIVED_AT,
      header: H.receivedAt,
      sortable: true,
      cell: (row) =>
        row.receivedAt ? (
          <span className={CELL.date}>{formatDateTime(row.receivedAt)}</span>
        ) : (
          <EmptyCell />
        ),
    },
    {
      key: C.SOURCE,
      header: H.source,
      cell: (row) => <SourceCell row={row} />,
    },
    {
      key: C.OPEN_TASK,
      header: H.openTask,
      cell: (row) => <OpenTaskCell row={row} />,
    },
    {
      key: C.ACTIONS,
      header: H.actions,
      align: "right",
      sticky: "right",
      cell: (row) => <ViewAction label={L.openDetail(row.lpn)} onOpen={() => onOpen(row)} />,
    },
  ];
}
