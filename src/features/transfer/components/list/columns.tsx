"use client";

import Link from "next/link";
import { Eye } from "lucide-react";

import { ADMIN_ROUTES, TRANSFER_COLUMNS, UI_LABELS } from "@/constants";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { statusCell } from "@/components/shared/column-helpers";
import { Button } from "@/components/ui/button";

import { MONO } from "../primitives";
import { COLUMN_LABELS } from "./constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { TransferOrderRow } from "@/features/transfer/types";

const C = TRANSFER_COLUMNS;

function textCell(
  key: string,
  render: (row: TransferOrderRow) => string,
  className = "text-ink-secondary",
): ColumnDef<TransferOrderRow> {
  return {
    key,
    header: COLUMN_LABELS[key] ?? key,
    cell: (row) => (
      <span className={`${className} text-[0.8125rem] tabular-nums`}>{render(row)}</span>
    ),
  };
}

const dateOrDash = (value: string | null | undefined, format: (v: string) => string) =>
  value ? format(value) : "—";

/**
 * Cột bảng lệnh chuyển — field BE `TransferOrderRowResponse`. Không có cột tracking: hãng / xe
 * nhà là bên ngoài, hệ thống chỉ ghi thời điểm xuất (rescope SCRUM-327).
 */
export function buildTransferColumns(
  navigateToDetail: (row: TransferOrderRow) => void,
  warehouseLabel: (id: string) => string,
): ColumnDef<TransferOrderRow>[] {
  return [
    {
      key: C.NUMBER,
      header: COLUMN_LABELS[C.NUMBER] ?? C.NUMBER,
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.transfers.detail(row.transferId)}
          className={`text-accent text-[0.8125rem] font-medium hover:underline ${MONO}`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.number}
        </Link>
      ),
    },
    textCell(C.FROM_WAREHOUSE, (row) => warehouseLabel(row.fromWarehouseId), "text-ink-primary"),
    textCell(C.TO_WAREHOUSE, (row) => warehouseLabel(row.toWarehouseId), "text-ink-primary"),
    textCell(C.EXPECTED_DATE, (row) => dateOrDash(row.expectedDate, formatDate)),
    textCell(C.DISPATCHED_AT, (row) => dateOrDash(row.dispatchedAt, formatDateTime)),
    textCell(C.CREATED_AT, (row) => formatDateTime(row.createdAt)),
    statusCell<TransferOrderRow>(
      C.STATUS,
      COLUMN_LABELS[C.STATUS] ?? C.STATUS,
      (row) => row.status,
      "to",
      { withIcon: true },
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
          aria-label={`${UI_LABELS.transfer.viewDetail} ${row.number}`}
        >
          <Eye className="size-3.5" />
        </Button>
      ),
    },
  ];
}
