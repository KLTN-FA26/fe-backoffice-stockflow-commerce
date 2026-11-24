"use client";

import Link from "next/link";

import { ADMIN_ROUTES, RECEIPT_COLUMNS, UI_LABELS } from "@/constants";
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
 * Cột bảng phiếu nhận — chỉ field có trong BE `GoodsReceiptRowResponse`. Dòng danh sách không kèm dòng nhận nên
 * không có cột SL.
 */
export function buildReceiptColumns(
  navigateToDetail: (row: GoodsReceiptRow) => void,
  /** Link chi tiết — màn Nhận hàng trong tab theo kho trỏ vào route của kho. */
  hrefOf: (row: GoodsReceiptRow) => string = (row) => ADMIN_ROUTES.receipts.detail(row.id),
): ColumnDef<GoodsReceiptRow>[] {
  return [
    {
      key: C.NUMBER,
      header: COLUMN_LABELS[C.NUMBER] ?? C.NUMBER,
      sortable: true,
      cell: (row) => (
        <Link
          href={hrefOf(row)}
          className={`${CELL.code} hover:underline`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.number}
        </Link>
      ),
    },
    {
      key: C.RECEIPT_TYPE,
      header: COLUMN_LABELS[C.RECEIPT_TYPE] ?? C.RECEIPT_TYPE,
      cell: (row) => (
        <span className="text-ink-secondary">{UI_LABELS.receipt.receiptType[row.receiptType]}</span>
      ),
    },
    {
      key: C.PRODUCTION_ORDER,
      header: COLUMN_LABELS[C.PRODUCTION_ORDER] ?? C.PRODUCTION_ORDER,
      cell: (row) =>
        row.productionOrderCode ? (
          <span className="inline-flex flex-col">
            <span className={CELL.ref} title={row.productionOrderId ?? undefined}>
              {row.productionOrderCode}
            </span>
            {row.producerName && (
              <span className="text-ink-tertiary mt-0.5 text-xs">{row.producerName}</span>
            )}
          </span>
        ) : (
          <span className="text-ink-tertiary">—</span>
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
