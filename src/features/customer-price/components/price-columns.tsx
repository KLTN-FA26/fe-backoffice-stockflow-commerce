import { Pencil } from "lucide-react";

import { CUSTOMER_PRICE_UI_LABELS } from "@/constants";
import { formatDecimalMoney, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";

import { priceRange } from "../selectors";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { CustomerPrice } from "../schemas";

const L = CUSTOMER_PRICE_UI_LABELS;
const MONO = "font-[family-name:var(--font-mono)]";

/** VND nguyên từ chuỗi chữ số — `Intl` định dạng thẳng chuỗi, không qua số thực. */
export const vnd = (digits: string) => formatDecimalMoney(digits, "VND", 0);

/** Thấp nhất / cao nhất qua mọi bậc; có bậc không chính xác thì báo, không trình bày như số chắc chắn. */
function rangeCell(price: CustomerPrice, which: "lowest" | "highest") {
  const range = priceRange(price);
  if (!range.exact) {
    return <span className="text-warning text-xs">{L.table.inexactCell}</span>;
  }
  return <span className="tabular-nums">{vnd(range[which])}</span>;
}

/** Cột bảng giá của một khách — chỉ đọc, không có cột thao tác (sửa / xoá làm ở bước sau). */
export const CUSTOMER_PRICE_COLUMNS: ColumnDef<CustomerPrice>[] = [
  {
    key: "sku",
    header: L.field.sku,
    sortable: true,
    compare: (a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0),
    cell: (p) => <span className={MONO}>{p.sku}</span>,
  },
  {
    key: "moq",
    header: L.field.moq,
    align: "right",
    sortable: true,
    compare: (a, b) => a.moq - b.moq,
    cell: (p) => <span className="tabular-nums">{formatNumber(p.moq)}</span>,
  },
  {
    key: "tiers",
    header: L.table.tierCount,
    align: "right",
    cell: (p) => <span className="tabular-nums">{p.tiers.length}</span>,
  },
  { key: "lowest", header: L.table.lowest, align: "right", cell: (p) => rangeCell(p, "lowest") },
  { key: "highest", header: L.table.highest, align: "right", cell: (p) => rangeCell(p, "highest") },
  {
    key: "note",
    header: L.field.note,
    cell: (p) => <span className="text-ink-secondary line-clamp-1">{p.note ?? "—"}</span>,
  },
];

/**
 * Cột "Sửa bảng giá" — chỉ thêm khi có `catalog-customer-prices:UPDATE` (UI-only, BE re-check). Nút
 * không kích hoạt bấm dòng (mở chi tiết).
 */
export function editColumn(onEdit: (sku: string) => void): ColumnDef<CustomerPrice> {
  return {
    key: "edit",
    header: "",
    align: "right",
    cell: (p) => (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={L.form.editRow(p.sku)}
        onClick={(e) => {
          e.stopPropagation();
          onEdit(p.sku);
        }}
      >
        <Pencil className="size-3.5" />
      </Button>
    ),
  };
}
