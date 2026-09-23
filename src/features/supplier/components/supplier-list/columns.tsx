"use client";

import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { ColumnFilterButton } from "@/components/shared/ListToolbar";
import { statusCell, textCell } from "@/components/shared/column-helpers";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { SupplierDto } from "@/features/supplier/types";

interface BuildColumnsArgs {
  columnSearch: Partial<Record<"supplierId" | "name" | "taxCode", string>>;
  updateColumnSearch: (key: "supplierId" | "name" | "taxCode", value: string) => void;
  navigateToDetail: (row: SupplierDto) => void;
}

export function buildSupplierColumns({
  columnSearch,
  updateColumnSearch,
  navigateToDetail,
}: BuildColumnsArgs): (ColumnDef<SupplierDto> & { key: string })[] {
  return [
    {
      key: "supplierId",
      header: "Mã NCC",
      sortable: true,
      compare: (a, b) => a.supplierId.localeCompare(b.supplierId),
      headerFilter: (
        <ColumnFilterButton
          value={columnSearch.supplierId ?? ""}
          label="Mã NCC"
          placeholder="Lọc mã NCC"
          onChange={(value) => updateColumnSearch("supplierId", value)}
        />
      ),
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.suppliers.detail(row.supplierId)}
          className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
          onClick={(event) => {
            event.preventDefault();
            navigateToDetail(row);
          }}
        >
          {row.supplierId}
        </Link>
      ),
    },
    {
      ...textCell<SupplierDto>("name", "Tên nhà cung cấp", (row) => row.name, {
        sortable: true,
        compare: (a, b) => a.name.localeCompare(b.name),
        color: "primary",
      }),
      key: "name",
      headerFilter: (
        <ColumnFilterButton
          value={columnSearch.name ?? ""}
          label="Tên"
          placeholder="Lọc tên NCC"
          onChange={(value) => updateColumnSearch("name", value)}
        />
      ),
    },
    textCell<SupplierDto>("taxCode", "Mã thuế", (row) => row.taxCode, {
      sortable: true,
      compare: (a, b) => a.taxCode.localeCompare(b.taxCode),
      color: "primary",
    }) as ColumnDef<SupplierDto> & { key: string },
    {
      key: "contact",
      header: "Liên hệ",
      cell: (row) => (
        <div className="text-[0.8125rem]">
          <div className="text-ink-primary">{row.contactName}</div>
          <div className="text-ink-secondary">{row.contactPhone}</div>
        </div>
      ),
    },
    {
      key: "leadTimeDays",
      header: "Lead time",
      align: "right",
      sortable: true,
      compare: (a, b) => (a.leadTimeDays ?? 0) - (b.leadTimeDays ?? 0),
      cell: (row) => (
        <span className="tabular-nums">
          {row.leadTimeDays != null ? `${row.leadTimeDays} ngày` : "—"}
        </span>
      ),
    },
    {
      key: "rating",
      header: "Đánh giá",
      align: "right",
      sortable: true,
      compare: (a, b) => (a.rating ?? 0) - (b.rating ?? 0),
      cell: (row) => (
        <span className="tabular-nums">{row.rating != null ? row.rating.toFixed(1) : "—"}</span>
      ),
    },
    statusCell<SupplierDto>("status", "Trạng thái", (row) => row.status, "sku", {
      sortable: true,
      compare: (a, b) => a.status.localeCompare(b.status),
      withIcon: true,
    }) as ColumnDef<SupplierDto> & { key: string },
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
          aria-label="Xem chi tiết"
        >
          <Eye className="size-3.5" />
        </Button>
      ),
    },
  ];
}
