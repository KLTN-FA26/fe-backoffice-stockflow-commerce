"use client";

import Link from "next/link";

import { ADMIN_ROUTES, INVENTORY_ITEM_COLUMNS as C, UI_LABELS } from "@/constants";
import { CELL, refCell, textCell, ToneDot, viewColumn } from "@/components/shared/column-helpers";

import { COLUMN_LABELS } from "./constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { InventoryItemSummary } from "@/features/inventory-item/types";

type ItemColumn = ColumnDef<InventoryItemSummary> & { key: string };

const L = UI_LABELS.inventoryItem;

/** Cột bảng hồ sơ hàng tồn — BE chưa hỗ trợ sort nên không có cột sortable. */
export function buildInventoryItemColumns(): ItemColumn[] {
  return [
    {
      key: C.SKU,
      header: COLUMN_LABELS[C.SKU],
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.inventoryItems.detail(row.id)}
          className={`${CELL.code} hover:underline`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.sku}
        </Link>
      ),
    },
    refCell<InventoryItemSummary>(C.UOM, COLUMN_LABELS[C.UOM], (row) => row.unitOfMeasure),
    refCell<InventoryItemSummary>(C.BARCODE, COLUMN_LABELS[C.BARCODE], (row) => row.barcode),
    textCell<InventoryItemSummary>(
      C.STORAGE,
      COLUMN_LABELS[C.STORAGE],
      (row) => L.storageClass[row.storageClass],
    ),
    textCell<InventoryItemSummary>(
      C.TRACKING,
      COLUMN_LABELS[C.TRACKING],
      (row) => L.trackingMode[row.trackingMode],
    ),
    {
      key: C.POLICY,
      header: COLUMN_LABELS[C.POLICY],
      // Cờ đã / chưa cấu hình không nằm trong status-map → ToneDot cùng dáng StatusDot
      cell: (row) =>
        row.policyConfigured ? (
          <ToneDot tone="positive" label={L.policy.configured} />
        ) : (
          <ToneDot tone="warning" label={L.policy.unconfigured} />
        ),
    },
  ];
}

/** Nút xem cuối dòng — luôn hiện, không nằm trong ẩn/hiện cột. */
export const inventoryItemViewColumn = () =>
  viewColumn<InventoryItemSummary>((row) => ({
    label: `Xem chi tiết ${row.sku}`,
    href: ADMIN_ROUTES.inventoryItems.detail(row.id),
  }));
