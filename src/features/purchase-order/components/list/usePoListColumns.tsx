"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Eye } from "lucide-react";

import { ADMIN_ROUTES, PO_COLUMNS } from "@/constants";
import type { ColumnDef } from "@/components/shared/DataTable";
import { ColumnFilterButton } from "@/components/shared/ListToolbar";
import { dateCell, statusCell, textCell } from "@/components/shared/column-helpers";
import { Button } from "@/components/ui/button";

import { formatMoney } from "@/features/purchase-order";

import type { PurchaseOrder, Supplier, Warehouse } from "@/features/purchase-order";
import { supplierName, warehouseName } from "./helpers";
import type { PoColumnSearchKey, PoTableColumnKey } from "./config";

export function usePoListColumns({
  suppliers,
  warehouses,
  columnSearch,
  onColumnSearch,
  onNavigate,
}: {
  suppliers: readonly Supplier[];
  warehouses: readonly Warehouse[];
  columnSearch: Partial<Record<PoColumnSearchKey, string>>;
  onColumnSearch: (key: PoColumnSearchKey, value: string) => void;
  onNavigate: (po: PurchaseOrder) => void;
}): (ColumnDef<PurchaseOrder> & { key: PoTableColumnKey })[] {
  return useMemo<(ColumnDef<PurchaseOrder> & { key: PoTableColumnKey })[]>(
    () => [
      {
        key: PO_COLUMNS.PO_NUMBER,
        header: "Mã PO",
        sortable: true,
        compare: (a, b) => a.poNumber.localeCompare(b.poNumber),
        headerFilter: (
          <ColumnFilterButton
            value={columnSearch.poNumber ?? ""}
            label="Mã PO"
            placeholder="Lọc mã PO"
            onChange={(v) => onColumnSearch(PO_COLUMNS.PO_NUMBER, v)}
          />
        ),
        cell: (row) => (
          <Link
            href={ADMIN_ROUTES.purchaseOrders.detail(row.poId)}
            className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
            onClick={(e) => {
              e.preventDefault();
              onNavigate(row);
            }}
          >
            {row.poNumber}
          </Link>
        ),
      },
      {
        ...textCell<PurchaseOrder>(
          PO_COLUMNS.SUPPLIER,
          "Nhà cung cấp",
          (r) => supplierName(r, suppliers) || "—",
          {
            sortable: true,
            compare: (a, b) => supplierName(a, suppliers).localeCompare(supplierName(b, suppliers)),
            color: "primary",
          },
        ),
        key: PO_COLUMNS.SUPPLIER,
        headerFilter: (
          <ColumnFilterButton
            value={columnSearch.supplier ?? ""}
            label="Nhà cung cấp"
            placeholder="Lọc NCC"
            onChange={(v) => onColumnSearch(PO_COLUMNS.SUPPLIER, v)}
          />
        ),
      },
      {
        ...textCell<PurchaseOrder>(
          PO_COLUMNS.WAREHOUSE,
          "Kho nhận",
          (r) => warehouseName(r, warehouses) || "—",
          {
            sortable: true,
            compare: (a, b) =>
              warehouseName(a, warehouses).localeCompare(warehouseName(b, warehouses)),
            color: "secondary",
          },
        ),
        key: PO_COLUMNS.WAREHOUSE,
        headerFilter: (
          <ColumnFilterButton
            value={columnSearch.warehouse ?? ""}
            label="Kho nhận"
            placeholder="Lọc kho"
            onChange={(v) => onColumnSearch(PO_COLUMNS.WAREHOUSE, v)}
          />
        ),
      },
      dateCell<PurchaseOrder>("expectedDate", "Ngày giao DK", (r) => r.expectedDate, {
        sortable: true,
        compare: (a, b) => new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime(),
      }) as ColumnDef<PurchaseOrder> & { key: PoTableColumnKey },
      {
        key: "grandTotal",
        header: "Tổng tiền",
        align: "right",
        sortable: true,
        compare: (a, b) => a.grandTotal - b.grandTotal,
        cell: (row) => (
          <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium tabular-nums">
            {formatMoney(row.grandTotal, row.currency)}
          </span>
        ),
      },
      statusCell<PurchaseOrder>("status", "Trạng thái", (r) => r.status, "po", {
        sortable: true,
        compare: (a, b) => a.status.localeCompare(b.status),
        withIcon: true,
      }) as ColumnDef<PurchaseOrder> & { key: PoTableColumnKey },
      {
        key: PO_COLUMNS.ACTIONS,
        header: "",
        cell: (row) => (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(row);
            }}
            className="border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)]"
            aria-label="Xem chi tiết"
          >
            <Eye className="size-3.5" />
          </Button>
        ),
      },
    ],
    [columnSearch, onColumnSearch, onNavigate, suppliers, warehouses],
  );
}
