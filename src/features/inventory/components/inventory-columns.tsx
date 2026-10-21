"use client";

import Link from "next/link";

import { INVENTORY_LABELS, INVENTORY_ROUTES } from "@/constants/inventory";
import { STOCK_ADJUSTMENT_STATUS } from "@/constants/statuses";
import {
  CELL,
  dateCell,
  numberCell,
  refCell,
  statusCell,
  textCell,
  viewColumn,
} from "@/components/shared/column-helpers";

import {
  adjustmentReasonLabel,
  formatSignedQuantity,
  movementStatusLabel,
  movementTypeLabel,
} from "../selectors";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { StockAdjustment, StockMovement } from "../types";

const L = INVENTORY_LABELS;

/** Phiếu chờ duyệt → viền trái cảnh báo (data-table-mode-a: row "cần chú ý"). */
export const isPendingAdjustment = (row: StockAdjustment) =>
  row.status === STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL;

/** Cột bảng phiếu điều chỉnh tồn — chuẩn ô bảng Mode A (column-helpers). */
export function buildAdjustmentColumns(): ColumnDef<StockAdjustment>[] {
  return [
    {
      key: "number",
      header: L.adjustmentNumber,
      cell: (row) => (
        <Link
          href={INVENTORY_ROUTES.adjustment(row.adjustmentId)}
          className={`${CELL.code} hover:underline`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.number}
        </Link>
      ),
    },
    refCell<StockAdjustment>("sku", L.sku, (row) => row.sku),
    refCell<StockAdjustment>("location", L.location, (row) => row.locationCode),
    dateCell<StockAdjustment>("requestedAt", L.requestedAt, (row) => row.requestedAt, {
      withTime: true,
    }),
    {
      key: "quantityDelta",
      header: L.quantityDelta,
      align: "right",
      cell: (row) => <span className={CELL.number}>{formatSignedQuantity(row.quantityDelta)}</span>,
    },
    textCell<StockAdjustment>("reason", L.reason, (row) => adjustmentReasonLabel(row.reason)),
    statusCell<StockAdjustment>("status", L.status, (row) => row.status, "stock"),
    viewColumn<StockAdjustment>((row) => ({
      label: `Xem ${row.number}`,
      href: INVENTORY_ROUTES.adjustment(row.adjustmentId),
    })),
  ];
}

/** Cột sổ biến động tồn — chỉ đọc, không có trang chi tiết nên không có cột hành động. */
export function buildMovementColumns(): ColumnDef<StockMovement>[] {
  return [
    dateCell<StockMovement>("occurredAt", L.occurredAt, (row) => row.occurredAt, {
      withTime: true,
    }),
    textCell<StockMovement>("type", L.movementType, (row) => movementTypeLabel(row.type), {
      color: "primary",
    }),
    {
      key: "sku",
      header: L.sku,
      cell: (row) => <span className={CELL.code}>{row.sku}</span>,
    },
    refCell<StockMovement>("lot", L.lot, (row) => row.lotNumber),
    refCell<StockMovement>("fromLocation", L.fromLocation, (row) => row.fromLocation),
    refCell<StockMovement>("toLocation", L.toLocation, (row) => row.toLocation),
    textCell<StockMovement>("status", L.status, (row) =>
      movementStatusLabel(row.status, row.toStatus),
    ),
    numberCell<StockMovement>("quantity", L.quantity, (row) => row.quantity),
    refCell<StockMovement>("reference", L.reference, (row) => row.referenceType),
    textCell<StockMovement>("reason", L.reason, (row) => row.reason ?? ""),
  ];
}
