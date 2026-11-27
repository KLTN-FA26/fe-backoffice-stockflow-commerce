import { Pencil, Trash2 } from "lucide-react";

import { STANDARD_PRICE_UI_LABELS } from "@/constants";
import { formatDecimalMoney, formatNumber } from "@/lib/format";
import { tiersAscending } from "@/lib/pricing/price-tiers";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { StandardPrice } from "../schemas";

const L = STANDARD_PRICE_UI_LABELS;
const MONO = "font-[family-name:var(--font-mono)]";

/** VND nguyên từ chuỗi chữ số — `Intl` định dạng thẳng chuỗi, không qua số thực. */
export const vnd = (digits: string) => formatDecimalMoney(digits, "VND", 0);

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Cột danh sách giá chuẩn: SKU quy cách, sản phẩm, quy cách, các bậc giá, ghi chú. */
export const STANDARD_PRICE_COLUMNS: ColumnDef<StandardPrice>[] = [
  {
    key: "sku",
    header: L.field.sku,
    sortable: true,
    compare: (a, b) => byText(a.sku, b.sku),
    cell: (p) => <span className={MONO}>{p.sku}</span>,
  },
  {
    key: "product",
    header: L.field.product,
    sortable: true,
    compare: (a, b) => byText(a.productName ?? "", b.productName ?? ""),
    cell: (p) => <span>{p.productName ?? L.table.unnamed}</span>,
  },
  {
    key: "variant",
    header: L.field.variant,
    cell: (p) => <span className="text-ink-secondary">{p.variantName ?? L.table.unnamed}</span>,
  },
  {
    key: "tiers",
    header: L.field.tiers,
    cell: (p) => (
      <ul className="space-y-0.5 text-xs tabular-nums">
        {tiersAscending(p.tiers).map((tier) => (
          <li key={tier.minQuantity}>
            {L.table.tierLine(formatNumber(tier.minQuantity), vnd(tier.unitPrice))}
          </li>
        ))}
      </ul>
    ),
  },
  {
    key: "note",
    header: L.field.note,
    cell: (p) => <span className="text-ink-secondary line-clamp-2">{p.note ?? "—"}</span>,
  },
];

/**
 * Cột thao tác — chỉ thêm khi có `catalog-standard-prices:UPDATE` và / hoặc `:DELETE` (UI-only, BE re-check). Nút không
 * kích hoạt bấm dòng.
 */
export function actionColumn(
  onEdit: ((price: StandardPrice) => void) | undefined,
  onDelete: ((price: StandardPrice) => void) | undefined,
): ColumnDef<StandardPrice> {
  return {
    key: "actions",
    header: "Thao tác",
    align: "right",
    className: "w-20",
    cell: (p) => (
      <RowActionsMenu
        label={`Thao tác — ${p.sku}`}
        actions={[
          ...(onEdit ? [{ label: "Sửa giá chuẩn", icon: Pencil, onSelect: () => onEdit(p) }] : []),
          ...(onDelete
            ? [{ label: "Xoá giá chuẩn", icon: Trash2, danger: true, onSelect: () => onDelete(p) }]
            : []),
        ]}
      />
    ),
  };
}
