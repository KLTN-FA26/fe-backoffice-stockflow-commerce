"use client";

import { Layers } from "lucide-react";

import { PRODUCTION_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format";

import { productionOrderTotals } from "@/features/production-order/selectors";

import { CELL, EMPTY_CELL } from "@/components/shared/column-helpers";
import { DataTable } from "@/components/shared/DataTable";
import { DetailSection } from "@/components/shared/DetailSection";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { ProductionOrder, ProductionOrderLine } from "@/features/production-order/types";

const L = PRODUCTION_LABELS.detail;
const C = L.lineColumns;
const num = formatNumber;

const COLUMNS: ColumnDef<ProductionOrderLine>[] = [
  { key: "sku", header: C.sku, cell: (row) => <span className={CELL.code}>{row.sku}</span> },
  {
    key: "cartons",
    header: C.cartons,
    align: "right",
    cell: (row) => <span className={CELL.number}>{num(row.cartons)}</span>,
  },
  {
    key: "upc",
    header: C.unitsPerCarton,
    align: "right",
    cell: (row) => <span className={CELL.number}>{num(row.unitsPerCarton)}</span>,
  },
  {
    key: "units",
    header: C.totalUnits,
    align: "right",
    cell: (row) => <span className={CELL.number}>{num(row.totalUnits)}</span>,
  },
  {
    key: "packing",
    header: C.packing,
    cell: (row) => (
      <span className={`${CELL.text} whitespace-pre-line`}>
        {row.packingRequirements || EMPTY_CELL}
      </span>
    ),
  },
  {
    key: "received",
    header: C.received,
    align: "right",
    cell: (row) => (
      <span className={CELL.number}>
        {num(row.receivedCartons)} / {num(row.cartons)}
      </span>
    ),
  },
];

/**
 * Dòng sản xuất (docs 17 §4.3): SKU riêng của khách, số thùng, cái / thùng, tổng cái, yêu cầu đóng gói / dán nhãn, và
 * số thùng đã nhập kho (§4.3 bước 11 — nhập theo số thùng).
 */
export function LinesCard({ order }: { order: ProductionOrder }) {
  const totals = productionOrderTotals(order);
  return (
    <DetailSection title={`${L.lines} (${order.lines.length})`} icon={Layers}>
      <DataTable
        columns={COLUMNS}
        data={order.lines}
        rowKey={(row) => row.id}
        caption={`${C.cartons}: ${num(totals.cartons)} · ${C.totalUnits}: ${num(totals.totalUnits)} · ${C.received}: ${num(totals.receivedCartons)}`}
      />
    </DetailSection>
  );
}
