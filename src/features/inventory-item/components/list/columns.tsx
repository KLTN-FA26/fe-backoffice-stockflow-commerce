"use client";

import Link from "next/link";

import { Eye } from "lucide-react";

import { ADMIN_ROUTES, INVENTORY_ITEM_COLUMNS as C } from "@/constants";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { CELL, refCell } from "@/components/shared/column-helpers";

import { ACTIONS_COLUMN, COLUMN_LABELS } from "./constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { InventoryItemSummary } from "@/features/inventory-item/types";

type ItemColumn = ColumnDef<InventoryItemSummary> & { key: string };

/** Cột bảng hồ sơ hàng tồn (BE `InventoryItemSummaryResponse`) — BE chưa hỗ trợ sort nên không có cột sortable. */
export function buildInventoryItemColumns(): ItemColumn[] {
  return [
    {
      key: C.SKU,
      header: COLUMN_LABELS[C.SKU],
      className: "min-w-48",
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
    {
      ...refCell<InventoryItemSummary>(C.UOM, COLUMN_LABELS[C.UOM], (row) => row.unitOfMeasure),
      className: "min-w-28",
    },
    {
      ...refCell<InventoryItemSummary>(C.BARCODE, COLUMN_LABELS[C.BARCODE], (row) => row.barcode),
      className: "min-w-44",
    },
  ];
}

/** Cột "Thao tác" cuối dòng (nút xem) — luôn hiện, không nằm trong ẩn/hiện cột. */
export const inventoryItemViewColumn = (): ColumnDef<InventoryItemSummary> => ({
  key: ACTIONS_COLUMN.key,
  header: ACTIONS_COLUMN.header,
  className: "w-20",
  cell: (row) => (
    <RowActionsMenu
      label={`Thao tác — ${row.sku}`}
      actions={[
        { label: "Xem chi tiết", icon: Eye, href: ADMIN_ROUTES.inventoryItems.detail(row.id) },
      ]}
    />
  ),
});
