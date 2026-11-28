import { SHORTAGE_LABELS } from "@/constants";

import type { ShortageCardLine } from "@/lib/domain/shortage-card";

const L = SHORTAGE_LABELS;
const HEAD = "text-ink-primary px-3 py-2 text-right font-semibold first:text-left";
const CELL = "px-3 py-2 text-right tabular-nums first:text-left";

/**
 * Bảng SKU của thẻ: số thùng của đợt, đã có, thiếu (đơn vị: thùng). Bảng tĩnh vài dòng (một dòng cho mỗi SKU thiếu), không
 * lọc / sắp xếp / phân trang nên không dùng `DataTable` — chân phân trang của nó chỉ làm rối một bảng một dòng.
 */
export function ShortageLinesTable({ lines }: { lines: readonly ShortageCardLine[] }) {
  return (
    <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
      <table className="w-full text-[0.8125rem]">
        <caption className="sr-only">{`${L.tableProduct} (${L.tableUnit})`}</caption>
        <thead className="bg-bg-subtle">
          <tr>
            <th scope="col" className={HEAD}>
              {L.tableProduct}
            </th>
            <th scope="col" className={HEAD}>
              {L.tableInBatch}
            </th>
            <th scope="col" className={HEAD}>
              {L.tableAvailable}
            </th>
            <th scope="col" className={HEAD}>
              {L.tableMissing}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--table-line)]">
          {lines.map((line) => (
            <tr key={line.sku}>
              <td className={CELL}>
                <span className="flex min-w-0 flex-col">
                  <span className="text-ink-primary truncate font-medium">
                    {line.skuName ?? line.sku}
                  </span>
                  <span className="text-ink-tertiary truncate font-[family-name:var(--font-mono)] text-xs">
                    {line.sku}
                  </span>
                </span>
              </td>
              <td className={CELL}>{line.batchCartons}</td>
              <td className={CELL}>{line.availableCartons}</td>
              <td className={`${CELL} text-danger font-semibold`}>{line.missingCartons}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
