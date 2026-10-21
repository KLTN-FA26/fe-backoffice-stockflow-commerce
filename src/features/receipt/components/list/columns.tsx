"use client";

import Link from "next/link";

import { ADMIN_ROUTES, RECEIPT_COLUMNS } from "@/constants";
import {
  CELL,
  dateCell,
  refCell,
  statusCell,
  viewColumn,
} from "@/components/shared/column-helpers";

import { COLUMN_LABELS, SERVER_SORT_FIELDS } from "./constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { GoodsReceiptRow } from "@/features/receipt/types";

const C = RECEIPT_COLUMNS;

function sortable(key: string): boolean {
  return key in SERVER_SORT_FIELDS;
}

function dateTimeCell(
  key: string,
  getValue: (row: GoodsReceiptRow) => string | null | undefined,
): ColumnDef<GoodsReceiptRow> {
  return dateCell(key, COLUMN_LABELS[key] ?? key, getValue, {
    sortable: sortable(key),
    withTime: true,
  });
}

/**
 * Cột bảng phiếu nhận — chỉ field có trong BE `GoodsReceiptRowResponse` (PR #62). Dòng danh sách
 * không kèm dòng nhận nên không có cột SL; số PO tra qua `poNumbers` (BE chỉ trả id).
 */
export function buildReceiptColumns(
  navigateToDetail: (row: GoodsReceiptRow) => void,
  poNumbers: Readonly<Record<string, string>> | undefined,
): ColumnDef<GoodsReceiptRow>[] {
  return [
    {
      key: C.NUMBER,
      header: COLUMN_LABELS[C.NUMBER] ?? C.NUMBER,
      sortable: true,
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.receipts.detail(row.id)}
          className={`${CELL.code} hover:underline`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.number}
        </Link>
      ),
    },
    {
      key: C.PURCHASE_ORDER,
      header: COLUMN_LABELS[C.PURCHASE_ORDER] ?? C.PURCHASE_ORDER,
      cell: (row) => (
        <span className={CELL.ref} title={row.purchaseOrderId}>
          {poNumbers?.[row.purchaseOrderId] ?? "—"}
        </span>
      ),
    },
    refCell<GoodsReceiptRow>(
      C.DELIVERY_NOTE,
      COLUMN_LABELS[C.DELIVERY_NOTE] ?? C.DELIVERY_NOTE,
      (row) => row.deliveryNote,
    ),
    dateTimeCell(C.RECEIVED_AT, (row) => row.receivedAt),
    dateTimeCell(C.CONFIRMED_AT, (row) => row.confirmedAt),
    statusCell<GoodsReceiptRow>(
      C.STATUS,
      COLUMN_LABELS[C.STATUS] ?? C.STATUS,
      (row) => row.status,
      "receipt",
      { sortable: true, withIcon: true },
    ),
    {
      ...viewColumn<GoodsReceiptRow>((row) => ({
        label: `Xem chi tiết ${row.number}`,
        onOpen: () => navigateToDetail(row),
      })),
      key: C.ACTIONS,
    },
  ];
}
