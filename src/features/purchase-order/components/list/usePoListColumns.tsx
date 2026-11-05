"use client";

import Link from "next/link";

import { ADMIN_ROUTES, PO_COLUMNS, UI_LABELS } from "@/constants";
import { formatDate } from "@/lib/format";
import { formatMoney, poAttentionReason } from "@/features/purchase-order";
import { ColumnFilterButton } from "@/components/shared/ListToolbar";
import {
  CELL,
  EMPTY_CELL,
  EmptyCell,
  statusCell,
  viewColumn,
} from "@/components/shared/column-helpers";

import { supplierLabel } from "./helpers";

import type { SupplierRef } from "@/lib/references/supplier-lookup";
import type { PurchaseOrder } from "@/features/purchase-order";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { PoColumnSearchKey, PoTableColumnKey } from "./config";

type PoColumn = ColumnDef<PurchaseOrder> & { key: PoTableColumnKey };

const statusColumn = statusCell<PurchaseOrder>(
  PO_COLUMNS.STATUS,
  UI_LABELS.purchaseOrder.status,
  (r) => r.status,
  "po",
  { sortable: true, withIcon: true },
);

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
          className={`${CELL.code} hover:underline`}
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
      cell: (row) => {
        const label = supplierLabel(row, supplierRefs);
        return label === EMPTY_CELL ? <EmptyCell /> : <span className={CELL.name}>{label}</span>;
      },
    },
    {
      key: PO_COLUMNS.EXPECTED_DATE,
      header: UI_LABELS.purchaseOrder.expectedDateShort,
      sortable: true,
      cell: (row) =>
        row.expectedDate ? (
          <span className={CELL.date}>{formatDate(row.expectedDate)}</span>
        ) : (
          <EmptyCell />
        ),
    },
    {
      key: PO_COLUMNS.GRAND_TOTAL,
      header: UI_LABELS.purchaseOrder.totalAmount,
      align: "right",
      cell: (row) => (
        <span className={CELL.number}>{formatMoney(row.grandTotal, row.currency)}</span>
      ),
    },
    {
      ...statusColumn,
      key: PO_COLUMNS.STATUS,
      // Đơn cần xử lý: thêm một dòng lý do dưới trạng thái để biết vì sao bị đánh dấu.
      cell: (row) => {
        const reason = poAttentionReason(row);
        return (
          <div className="flex flex-col items-start gap-0.5">
            {statusColumn.cell(row)}
            {reason && (
              <span className="text-warning text-xs">
                {UI_LABELS.purchaseOrder.attention[reason]}
              </span>
            )}
          </div>
        );
      },
    },
    {
      ...viewColumn<PurchaseOrder>((row) => ({
        label: `Xem chi tiết ${row.poNumber}`,
        onOpen: () => onNavigate(row),
      })),
      key: PO_COLUMNS.ACTIONS,
    },
  ];
}
