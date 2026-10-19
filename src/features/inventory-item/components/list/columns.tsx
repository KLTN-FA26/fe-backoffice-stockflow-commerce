"use client";

import Link from "next/link";

import { ADMIN_ROUTES, INVENTORY_ITEM_COLUMNS as C, UI_LABELS } from "@/constants";

import { COLUMN_LABELS } from "./constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { InventoryItemSummary } from "@/features/inventory-item/types";

type ItemColumn = ColumnDef<InventoryItemSummary> & { key: string };

const L = UI_LABELS.inventoryItem;
const mono = "font-[family-name:var(--font-mono)] tabular-nums";

function ToneLabel({ dot, className, label }: { dot: string; className: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

/** Cột bảng hồ sơ hàng tồn — BE chưa hỗ trợ sort nên không có cột sortable. */
export function buildInventoryItemColumns(): ItemColumn[] {
  return [
    {
      key: C.SKU,
      header: COLUMN_LABELS[C.SKU],
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.inventoryItems.detail(row.id)}
          className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.sku}
        </Link>
      ),
    },
    {
      key: C.UOM,
      header: COLUMN_LABELS[C.UOM],
      cell: (row) => <span className={mono}>{row.unitOfMeasure}</span>,
    },
    {
      key: C.BARCODE,
      header: COLUMN_LABELS[C.BARCODE],
      cell: (row) => <span className={mono}>{row.barcode ?? "—"}</span>,
    },
    {
      key: C.STORAGE,
      header: COLUMN_LABELS[C.STORAGE],
      cell: (row) => L.storageClass[row.storageClass],
    },
    {
      key: C.TRACKING,
      header: COLUMN_LABELS[C.TRACKING],
      cell: (row) => L.trackingMode[row.trackingMode],
    },
    {
      key: C.POLICY,
      header: COLUMN_LABELS[C.POLICY],
      cell: (row) =>
        row.policyConfigured ? (
          <ToneLabel dot="bg-positive" className="text-positive" label={L.policy.configured} />
        ) : (
          <ToneLabel dot="bg-warning" className="text-warning" label={L.policy.unconfigured} />
        ),
    },
  ];
}
