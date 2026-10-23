"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

import { ADMIN_ROUTES, SUPPLIER_ITEM_UI_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { SupplierItemActions } from "@/features/supplier/lifecycle";
import type { SupplierItem } from "@/features/supplier/types";

const L = SUPPLIER_ITEM_UI_LABELS;
const C = L.column;
const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem]";
const NUM = `${MONO} tabular-nums`;
const ICON_BUTTON =
  "border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)]";

function numberColumn(
  key: string,
  header: string,
  value: (row: SupplierItem) => string,
): ColumnDef<SupplierItem> {
  return { key, header, align: "right", cell: (row) => <span className={NUM}>{value(row)}</span> };
}

/**
 * Cột bảng danh mục hàng NCC. Chỉ cột giá sắp xếp được (`currentPrice`, server). Nút thao tác theo
 * `supplierItemActions` — UI-only, Backend phải re-check (@RequiresPermission procurement-supplier-items).
 */
export function buildSupplierItemColumns({
  actions,
  canOpenInventoryItem,
  onEdit,
  onDelete,
}: {
  actions: SupplierItemActions;
  /** Có `inventory-inventory-items:READ` → SKU link tới Hồ sơ hàng tồn (logistics, chính sách tồn). */
  canOpenInventoryItem: boolean;
  onEdit: (item: SupplierItem) => void;
  onDelete: (item: SupplierItem) => void;
}): ColumnDef<SupplierItem>[] {
  const columns: ColumnDef<SupplierItem>[] = [
    {
      key: "sku",
      header: C.sku,
      cell: (row) =>
        canOpenInventoryItem ? (
          <Link
            href={ADMIN_ROUTES.inventoryItems.detail(row.inventoryItemId)}
            className={`${MONO} text-ink-primary font-medium underline-offset-2 hover:underline`}
          >
            {row.sku}
          </Link>
        ) : (
          <span className={`${MONO} text-ink-primary font-medium`}>{row.sku}</span>
        ),
    },
    {
      key: "supplierSkuCode",
      header: C.supplierSkuCode,
      cell: (row) => <span className={MONO}>{row.supplierSkuCode ?? "—"}</span>,
    },
    {
      // BE nhận `sort=currentPrice,…`; tiền tệ lấy từ dòng (BE quy về tiền tệ NCC — BR-07 docs 02 §6)
      ...numberColumn("currentPrice", C.price, (row) => formatMoney(row.price, row.currency)),
      sortable: true,
    },
    numberColumn("moq", C.moq, (row) => String(row.moq)),
    numberColumn("packSize", C.packSize, (row) => String(row.packSize)),
    numberColumn("leadTime", C.leadTime, (row) =>
      row.leadTimeDays === null
        ? L.supplierDefaultDays(row.effectiveLeadTimeDays)
        : L.days(row.leadTimeDays),
    ),
    {
      key: "preferred",
      header: C.preferred,
      // docs 01 §3 "Nhà cung cấp mặc định": dòng ưu tiên = NCC mặc định của SKU (BE #121)
      cell: (row) =>
        row.preferred ? (
          <span className="border-info/25 bg-info/10 text-info inline-flex rounded-[var(--r-sm)] border px-1.5 py-0.5 text-[0.6875rem] font-semibold">
            {L.preferredBadge}
          </span>
        ) : (
          <span className="text-ink-tertiary">—</span>
        ),
    },
  ];
  if (!actions.edit && !actions.remove) return columns;
  return [
    ...columns,
    {
      key: "actions",
      header: C.actions,
      align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          {actions.edit && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => onEdit(row)}
              className={ICON_BUTTON}
              aria-label={L.editAria(row.sku)}
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
          {actions.remove && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => onDelete(row)}
              className={`${ICON_BUTTON} hover:text-danger`}
              aria-label={L.deleteAria(row.sku)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];
}
