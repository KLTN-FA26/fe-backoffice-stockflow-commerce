import { SHORTAGE_LABELS } from "@/constants";
import { DataTable } from "@/components/shared/DataTable";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { ShortageCardLine } from "@/lib/domain/shortage-card";

const L = SHORTAGE_LABELS;
const NUMBER = "tabular-nums";

const COLUMNS: ColumnDef<ShortageCardLine>[] = [
  {
    key: "sku",
    header: L.tableProduct,
    className: "min-w-56",
    cell: (line) => (
      <span className="flex min-w-0 flex-col">
        <span className="text-ink-primary truncate font-medium">{line.skuName ?? line.sku}</span>
        <span className="text-ink-tertiary truncate font-[family-name:var(--font-mono)] text-xs">
          {line.sku}
        </span>
      </span>
    ),
  },
  {
    key: "batch",
    header: L.tableInBatch,
    align: "right",
    cell: (line) => <span className={NUMBER}>{line.batchCartons}</span>,
  },
  {
    key: "available",
    header: L.tableAvailable,
    align: "right",
    cell: (line) => <span className={NUMBER}>{line.availableCartons}</span>,
  },
  {
    key: "missing",
    header: L.tableMissing,
    align: "right",
    cell: (line) => (
      <span className={`${NUMBER} text-danger font-semibold`}>{line.missingCartons}</span>
    ),
  },
];

/** Bảng SKU của thẻ: số thùng của đợt, đã có, thiếu (đơn vị: thùng). */
export function ShortageLinesTable({ lines }: { lines: readonly ShortageCardLine[] }) {
  return (
    <DataTable
      data={[...lines]}
      columns={COLUMNS}
      rowKey={(line) => line.sku}
      caption={`${L.tableProduct} (${L.tableUnit})`}
      dense
    />
  );
}
