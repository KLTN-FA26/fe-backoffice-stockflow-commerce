import { UI_LABELS } from "@/constants";
import { formatFixed, formatNumber } from "@/lib/format";
import { formatM3 } from "@/features/load-planning/lib/dims";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { EstimateComparison } from "@/features/load-planning/plan-types";

const R = UI_LABELS.loadPlan.detail.reconciliation;

const delta = (pct: number | null | undefined) =>
  pct === null || pct === undefined ? "—" : `${pct > 0 ? "+" : ""}${formatFixed(pct, 2)}%`;

/** Thể tích / khối lượng chỉ có khi ít nhất một đơn có ước lượng; vắng thì không vẽ bảng. */
export function Measures({ vs }: { vs: EstimateComparison }) {
  const { volumeMm3, weightKg } = vs;
  const rows: [string, string, string, number | null | undefined][] = [];
  if (volumeMm3)
    rows.push([
      R.volume,
      formatM3(volumeMm3.estimated),
      formatM3(volumeMm3.actual),
      volumeMm3.deltaPct,
    ]);
  if (weightKg)
    rows.push([
      R.weight,
      `${formatFixed(weightKg.estimated, 1)} kg`,
      `${formatFixed(weightKg.actual, 1)} kg`,
      weightKg.deltaPct,
    ]);
  if (rows.length === 0) return null;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead />
          <TableHead className="text-right">{R.estimated}</TableHead>
          <TableHead className="text-right">{R.actual}</TableHead>
          <TableHead className="text-right">{R.delta}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(([label, estimated, actual, pct]) => (
          <TableRow key={label}>
            <TableCell>{label}</TableCell>
            <TableCell className="text-right tabular-nums">{estimated}</TableCell>
            <TableCell className="text-right tabular-nums">{actual}</TableCell>
            <TableCell className="text-right tabular-nums">{delta(pct)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function Counts({
  head,
  rows,
}: {
  head: string;
  rows: readonly { key: string; label: string; estimated: number; actual: number }[];
}) {
  if (rows.length === 0) return null;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{head}</TableHead>
          <TableHead className="text-right">{R.estimated}</TableHead>
          <TableHead className="text-right">{R.actual}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell className="font-mono text-[0.8125rem]">{row.label}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(row.estimated)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(row.actual)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
