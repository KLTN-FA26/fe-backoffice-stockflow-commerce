"use client";

import { Pencil } from "lucide-react";

import { CARRIER_COLUMNS, UI_LABELS } from "@/constants";
import { CELL, EmptyCell } from "@/components/shared/column-helpers";
import { rowActionsColumn } from "@/components/shared/RowActionsMenu";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { Carrier } from "@/features/shipping/types";

const C = UI_LABELS.shipping.waybill.carriers;

/** Cột danh mục hãng: mã, tên, liên hệ, kiểu kết nối, trạng thái; nút Sửa chỉ khi có quyền sửa hãng. */
export function buildCarrierColumns(
  onEdit: ((carrier: Carrier) => void) | null,
): ColumnDef<Carrier>[] {
  const columns: ColumnDef<Carrier>[] = [
    {
      key: CARRIER_COLUMNS.CODE,
      header: C.column.code,
      cell: (row) => <span className={CELL.code}>{row.code}</span>,
    },
    {
      key: CARRIER_COLUMNS.NAME,
      header: C.column.name,
      cell: (row) => <span className={CELL.name}>{row.name}</span>,
    },
    {
      key: CARRIER_COLUMNS.CONTACT,
      header: C.column.contact,
      cell: (row) => {
        const contact = [row.contactName, row.contactPhone].filter(Boolean).join(" · ");
        return contact ? <span className={CELL.text}>{contact}</span> : <EmptyCell />;
      },
    },
    {
      key: CARRIER_COLUMNS.CONNECTION,
      header: C.column.connection,
      cell: (row) => (
        <span className={CELL.text}>
          {C.connectionType[row.connection?.connectionType ?? "MANUAL"]}
        </span>
      ),
    },
    {
      key: CARRIER_COLUMNS.STATUS,
      header: C.column.status,
      cell: (row) => (
        <span className={row.status === "ACTIVE" ? "text-positive" : "text-ink-tertiary"}>
          {C.status[row.status]}
        </span>
      ),
    },
  ];
  if (onEdit) {
    columns.push({
      ...rowActionsColumn<Carrier>((row) => ({
        label: `Thao tác — ${row.code}`,
        actions: [{ label: C.editAria(row.code), icon: Pencil, onSelect: () => onEdit(row) }],
      })),
      key: CARRIER_COLUMNS.ACTIONS,
      header: C.column.actions,
    });
  }
  return columns;
}
