"use client";

import Link from "next/link";
import { Eye } from "lucide-react";

import { ADMIN_ROUTES, RECEIPT_COLUMNS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { statusCell } from "@/components/shared/column-helpers";
import { Button } from "@/components/ui/button";

import { COLUMN_LABELS, SERVER_SORT_FIELDS } from "./constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { GoodsReceiptRow } from "@/features/receipt/types";

const C = RECEIPT_COLUMNS;
const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums";

function sortable(key: string): boolean {
  return key in SERVER_SORT_FIELDS;
}

function dateTimeCell(
  key: string,
  getValue: (row: GoodsReceiptRow) => string | null | undefined,
): ColumnDef<GoodsReceiptRow> {
  return {
    key,
    header: COLUMN_LABELS[key] ?? key,
    sortable: sortable(key),
    cell: (row) => {
      const value = getValue(row);
      return (
        <span className="text-ink-secondary text-[0.8125rem] tabular-nums">
          {value ? formatDateTime(value) : "—"}
        </span>
      );
    },
  };
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
          className={`text-accent font-medium hover:underline ${MONO}`}
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
        <span className={`text-ink-primary ${MONO}`} title={row.purchaseOrderId}>
          {poNumbers?.[row.purchaseOrderId] ?? "—"}
        </span>
      ),
    },
    {
      key: C.DELIVERY_NOTE,
      header: COLUMN_LABELS[C.DELIVERY_NOTE] ?? C.DELIVERY_NOTE,
      cell: (row) => (
        <span className={`text-ink-secondary ${MONO}`}>{row.deliveryNote ?? "—"}</span>
      ),
    },
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
      key: C.ACTIONS,
      header: "",
      cell: (row) => (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={(event) => {
            event.stopPropagation();
            navigateToDetail(row);
          }}
          className="border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)]"
          aria-label={`Xem chi tiết ${row.number}`}
        >
          <Eye className="size-3.5" />
        </Button>
      ),
    },
  ];
}
