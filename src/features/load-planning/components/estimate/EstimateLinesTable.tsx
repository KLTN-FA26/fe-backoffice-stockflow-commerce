import { LOAD_ESTIMATE_LABELS, LOAD_ESTIMATE_RULE_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatNominalCm } from "../../lib/dims";

import type { EstimateLine } from "../../estimate-types";

/**
 * Thùng hàng theo dòng đơn: quy tắc đóng gói đã dùng (LP2-2), đơn vị × hệ số, số thùng (kèm bộ N kiện — LP2-5),
 * thùng lẻ (LP2-4: thùng đủ cỡ, khối lượng theo tỉ lệ), kích thước (cm) và khối lượng một thùng. Chỉ trình bày.
 */
export function EstimateLinesTable({ lines }: { lines: readonly EstimateLine[] }) {
  const L = LOAD_ESTIMATE_LABELS.lines;
  if (lines.length === 0) return null;
  return (
    <div className="border-border-default rounded border">
      <div className="border-border-default bg-bg-subtle border-b px-3 py-2 text-sm font-medium">
        {L.title}
      </div>
      <Table>
        <TableCaption className="sr-only">{L.title}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{L.sku}</TableHead>
            <TableHead>{L.rule}</TableHead>
            <TableHead>{L.uom}</TableHead>
            <TableHead className="text-right">{L.cartons}</TableHead>
            <TableHead>{L.partial}</TableHead>
            <TableHead className="text-right">{L.dims}</TableHead>
            <TableHead className="text-right">{L.weight}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.orderLineId}>
              <TableCell className="font-[family-name:var(--font-mono)] text-xs">
                {line.sku}
              </TableCell>
              <TableCell className="text-ink-secondary text-xs">
                {LOAD_ESTIMATE_RULE_LABELS[line.rule] ?? line.rule}
              </TableCell>
              <TableCell className="text-xs whitespace-nowrap">
                {L.uomCell(line.uom, line.factor)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(line.cartons)}
                {line.kitParts > 1 && (
                  <span className="text-ink-tertiary ml-1 text-[11px]">
                    {L.kitParts(line.kitParts)}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-ink-secondary text-xs whitespace-nowrap tabular-nums">
                {line.partial
                  ? L.partialCell(line.partial.units, formatNumber(line.partial.weightKg))
                  : L.none}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap tabular-nums">
                {formatNominalCm(line.dimsMm)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(line.weightKg)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
