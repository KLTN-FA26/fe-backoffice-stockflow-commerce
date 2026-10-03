"use client";

import Link from "next/link";
import { Eye } from "lucide-react";

import { ADMIN_ROUTES, PO_COLUMNS, UI_LABELS } from "@/constants";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/features/purchase-order";
import { ColumnFilterButton } from "@/components/shared/ListToolbar";
import { statusCell } from "@/components/shared/column-helpers";
import { Button } from "@/components/ui/button";

import { supplierLabel } from "./helpers";

import type { SupplierRef } from "@/lib/references/supplier-lookup";
import type { PurchaseOrder } from "@/features/purchase-order";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { PoColumnSearchKey, PoTableColumnKey } from "./config";

type PoColumn = ColumnDef<PurchaseOrder> & { key: PoTableColumnKey };

/**
 * Cột bảng PO. Sắp xếp do BE làm (`serverSorting`) nên chỉ cột có trong whitelist sort của BE
 * (Mã PO, Ngày giao, Trạng thái) mới `sortable`. Tiền hiển thị theo `currency` của từng PO.
 */
export function usePoListColumns({
  supplierRefs,
  columnSearch,
  onColumnSearch,
  onNavigate,
}: {
  supplierRefs: ReadonlyMap<string, SupplierRef>;
  columnSearch: Partial<Record<PoColumnSearchKey, string>>;
  onColumnSearch: (key: PoColumnSearchKey, value: string) => void;
  onNavigate: (po: PurchaseOrder) => void;
}): PoColumn[] {
  return [
    {
      key: PO_COLUMNS.PO_NUMBER,
      header: "Mã PO",
      sortable: true,
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
        >
          {row.poNumber}
        </Link>
      ),
    },
    {
      key: PO_COLUMNS.SUPPLIER,
      header: UI_LABELS.purchaseOrder.supplier,
      headerFilter: (
        <ColumnFilterButton
          value={columnSearch.supplier ?? ""}
          label={UI_LABELS.purchaseOrder.supplier}
          placeholder="Lọc NCC"
          onChange={(v) => onColumnSearch(PO_COLUMNS.SUPPLIER, v)}
        />
      ),
      cell: (row) => (
        <span className="text-ink-primary text-[0.8125rem]">
          {supplierLabel(row, supplierRefs)}
        </span>
      ),
    },
    {
      key: PO_COLUMNS.EXPECTED_DATE,
      header: UI_LABELS.purchaseOrder.expectedDateShort,
      sortable: true,
      cell: (row) => (
        <span className="text-ink-tertiary text-[0.8125rem] tabular-nums">
          {row.expectedDate ? formatDate(row.expectedDate) : "—"}
        </span>
      ),
    },
    {
      key: PO_COLUMNS.GRAND_TOTAL,
      header: UI_LABELS.purchaseOrder.totalAmount,
      align: "right",
      cell: (row) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium tabular-nums">
          {formatMoney(row.grandTotal, row.currency)}
        </span>
      ),
    },
    {
      ...statusCell<PurchaseOrder>(
        PO_COLUMNS.STATUS,
        UI_LABELS.purchaseOrder.status,
        (r) => r.status,
        "po",
        {
          sortable: true,
          withIcon: true,
        },
      ),
      key: PO_COLUMNS.STATUS,
    },
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
  ];
}
