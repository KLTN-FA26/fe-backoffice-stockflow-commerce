"use client";

import Link from "next/link";
import { Eye } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { statusCell, textCell } from "@/components/shared/column-helpers";
import { Button } from "@/components/ui/button";

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
    cell: (row) => (
      <span className="font-[family-name:var(--font-mono)] tabular-nums">{getDays(row)} ngày</span>
    ),
  };
}

/** Cột bảng NCC. Chỉ code/name/status sort được (server). Không có search trong cột vì BE không hỗ trợ. */
export function buildSupplierColumns(
  navigateToDetail: (row: SupplierDto) => void,
): SupplierColumn[] {
  return [
    {
      key: "code",
      header: "Mã NCC",
      sortable: true,
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.suppliers.detail(row.supplierId)}
          className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.code}
        </Link>
      ),
    },
    {
      ...textCell<SupplierDto>("name", "Tên nhà cung cấp", (row) => row.name, {
        sortable: true,
        color: "primary",
      }),
      key: "name",
    },
    {
      key: "taxCode",
      header: "Mã số thuế",
      cell: (row) => (
        <span className="font-[family-name:var(--font-mono)] tabular-nums">
          {row.taxCode ?? "—"}
        </span>
      ),
    },
    {
      key: "contact",
      header: "Liên hệ",
      cell: (row) => (
        <div className="text-[0.8125rem]">
          <div className="text-ink-primary">{row.contactName ?? "—"}</div>
          <div className="text-ink-secondary">{row.email ?? row.phone ?? "—"}</div>
        </div>
      ),
    },
    daysCell("paymentTermDays", "Thanh toán", (row) => row.paymentTermDays),
    daysCell("leadTimeDays", "Giao hàng", (row) => row.leadTimeDays),
    {
      key: "channel",
      header: "Kênh gửi PO",
      cell: (row) => <span className="text-[0.8125rem]">{row.communicationChannel}</span>,
    },
    statusCell<SupplierDto>("status", "Trạng thái", (row) => row.status, "sku", {
      sortable: true,
      withIcon: true,
    }) as SupplierColumn,
    {
      key: "actions",
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
          aria-label={`Xem chi tiết ${row.name}`}
        >
          <Eye className="size-3.5" />
        </Button>
      ),
    },
  ];
}
