"use client";

import { Pencil } from "lucide-react";

import {
  PRODUCER_CHANNEL_LABELS,
  PRODUCER_COLUMNS as C,
  PRODUCER_STATUS_LABELS,
  PRODUCTION_LABELS,
} from "@/constants";

import { producerContact } from "@/features/producer/selectors";

import { CELL, codeCell, StackText, textCell, ToneDot } from "@/components/shared/column-helpers";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { Producer } from "@/features/producer/types";

const L = PRODUCTION_LABELS.producer;

/** Cột bảng đơn vị sản xuất; cột thao tác chỉ có khi được sửa (`producerActions().edit`). */
export function buildProducerColumns(
  onEdit: ((row: Producer) => void) | null,
): ColumnDef<Producer>[] {
  const col = L.column;
  const columns: ColumnDef<Producer>[] = [
    codeCell<Producer>(C.CODE, col.code, (row) => row.code),
    textCell<Producer>(C.NAME, col.name, (row) => row.name, { color: "primary" }),
    textCell<Producer>(C.CHANNEL, col.channel, (row) => PRODUCER_CHANNEL_LABELS[row.channel]),
    {
      key: C.CONTACT,
      header: col.contact,
      cell: (row) => {
        const contact = producerContact(row);
        return <StackText main={contact.main} sub={contact.sub} />;
      },
    },
    {
      key: C.LEAD_DAYS,
      header: col.leadDays,
      align: "right",
      cell: (row) => <span className={CELL.number}>{L.days(row.standardLeadDays)}</span>,
    },
    {
      key: C.STATUS,
      header: col.status,
      cell: (row) => (
        <ToneDot
          tone={row.status === "ACTIVE" ? "positive" : "muted"}
          label={PRODUCER_STATUS_LABELS[row.status]}
        />
      ),
    },
  ];
  if (!onEdit) return columns;
  return [
    ...columns,
    {
      key: C.ACTIONS,
      header: col.actions,
      align: "right",
      className: "w-20",
      cell: (row) => (
        <RowActionsMenu
          label={`Thao tác — ${row.code}`}
          actions={[{ label: L.form.editTitle, icon: Pencil, onSelect: () => onEdit(row) }]}
        />
      ),
    },
  ];
}
