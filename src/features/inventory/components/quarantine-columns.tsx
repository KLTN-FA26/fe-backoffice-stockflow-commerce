"use client";

import { QUARANTINE_LIST_LABELS } from "@/constants/quarantine";
import {
  CELL,
  EmptyCell,
  codeCell,
  refCell,
  statusCell,
  textCell,
} from "@/components/shared/column-helpers";

import { cartonStatusLabel } from "../quarantine-lifecycle";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { StockPackage } from "../quarantine-types";

const C = QUARANTINE_LIST_LABELS.columns;

/** Cột bảng thùng trong khu cách ly — chuẩn ô bảng Mode A (column-helpers). LPN mở màn quyết định của thùng đó. */
export function buildQuarantineColumns(open: (lpn: string) => void): ColumnDef<StockPackage>[] {
  return [
    codeCell<StockPackage>("lpn", C.lpn, (row) => row.lpn, { onClick: (row) => open(row.lpn) }),
    textCell<StockPackage>("sku", C.sku, (row) => row.sku, { color: "primary" }),
    refCell<StockPackage>("lot", C.lot, (row) => row.lotNumber ?? null),
    refCell<StockPackage>("location", C.location, (row) => row.locationCode ?? null),
    {
      key: "onHand",
      header: C.onHand,
      align: "right",
      cell: (row) => (
        <span className={CELL.number}>
          {row.onHand.toLocaleString("vi-VN")} / {row.nominalQty.toLocaleString("vi-VN")}
        </span>
      ),
    },
    {
      key: "reserved",
      header: C.reserved,
      align: "right",
      cell: (row) =>
        row.reserved > 0 ? (
          <span className={CELL.number}>{row.reserved.toLocaleString("vi-VN")}</span>
        ) : (
          <EmptyCell />
        ),
    },
    statusCell<StockPackage>("status", C.status, (row) => cartonStatusLabel(row.status), "stock"),
  ];
}
