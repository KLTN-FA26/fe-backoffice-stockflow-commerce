"use client";

import Link from "next/link";

import { ADMIN_ROUTES, SUPPLIER_CHANNEL_LABELS } from "@/constants";
import {
  CELL,
  refCell,
  StackText,
  statusCell,
  textCell,
  viewColumn,
} from "@/components/shared/column-helpers";

import { COLUMN_LABELS } from "./constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { SupplierDto } from "@/features/supplier/types";

type SupplierColumn = ColumnDef<SupplierDto> & { key: string };

function daysCell(
  key: string,
  header: string,
  getDays: (row: SupplierDto) => number,
): SupplierColumn {
  return {
    key,
    header,
    align: "right",
    cell: (row) => <span className={CELL.number}>{getDays(row)} ngày</span>,
  };
}

/** Cột bảng NCC. Chỉ code/name/status sort được (server). Không có search trong cột vì BE không hỗ trợ. */
export function buildSupplierColumns(
  navigateToDetail: (row: SupplierDto) => void,
): SupplierColumn[] {
  return [
    {
      key: "code",
      header: COLUMN_LABELS.code,
      sortable: true,
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.suppliers.detail(row.supplierId)}
          className={`${CELL.code} hover:underline`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.code}
        </Link>
      ),
    },
    {
      ...textCell<SupplierDto>("name", COLUMN_LABELS.name, (row) => row.name, {
        sortable: true,
        color: "primary",
      }),
      key: "name",
    },
    refCell<SupplierDto>("taxCode", COLUMN_LABELS.taxCode, (row) => row.taxCode),
    {
      key: "contact",
      header: COLUMN_LABELS.contact,
      cell: (row) => <StackText main={row.contactName} sub={row.email ?? row.phone} />,
    },
    daysCell("paymentTermDays", COLUMN_LABELS.paymentTermDays, (row) => row.paymentTermDays),
    daysCell("leadTimeDays", COLUMN_LABELS.leadTimeDays, (row) => row.leadTimeDays),
    textCell<SupplierDto>(
      "channel",
      COLUMN_LABELS.channel,
      (row) => SUPPLIER_CHANNEL_LABELS[row.communicationChannel],
    ),
    statusCell<SupplierDto>("status", COLUMN_LABELS.status, (row) => row.status, "sku", {
      sortable: true,
      withIcon: true,
    }) as SupplierColumn,
    viewColumn<SupplierDto>((row) => ({
      label: `Xem chi tiết ${row.name}`,
      onOpen: () => navigateToDetail(row),
    })),
  ];
}
