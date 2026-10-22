import { LOAD_PLAN_ESTIMATE_FLAG_LABELS, UI_LABELS } from "@/constants";
import { formatFixed, formatNumber } from "@/lib/format";
import { formatM3 } from "@/features/load-planning/lib/dims";
import { knownFlags } from "@/features/load-planning/reconciliation-schemas";
import { Alert } from "@/components/shared/Alert";
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

function Measures({ vs }: { vs: EstimateComparison }) {
  const rows: [string, string, string, number | null | undefined][] = [
    [
      R.volume,
      formatM3(vs.volumeMm3.estimated),
      formatM3(vs.volumeMm3.actual),
      vs.volumeMm3.deltaPct,
    ],
    [
      R.weight,
      `${formatFixed(vs.weightKg.estimated, 1)} kg`,
      `${formatFixed(vs.weightKg.actual, 1)} kg`,
      vs.weightKg.deltaPct,
    ],
  ];
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

function Counts({
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

/**
 * So kế hoạch với ước lượng HIỆN HÀNH của từng đơn (BE `vsEstimate`): CHỈ để tham khảo — cờ hiện như cảnh báo mềm, không
 * chặn chốt. Số xe chỉ so khi kế hoạch có một đơn; kế hoạch nhiều đơn chỉ liệt kê số xe mỗi ước lượng cần.
 */
export function EstimateComparisonPanel({ vs }: { vs: EstimateComparison | null | undefined }) {
  if (!vs) return <p className="text-ink-tertiary text-sm">{R.noEstimate}</p>;
  const flags = knownFlags(vs.flags);
  return (
    <div className="space-y-3">
      <p className="text-ink-tertiary text-xs">{R.advisory}</p>
      {flags.length === 0 ? (
        <Alert tone="info">{R.noFlags}</Alert>
      ) : (
        <ul className="space-y-1.5">
          {flags.map((flag) => (
            <li key={flag}>
              <Alert tone="warning">{LOAD_PLAN_ESTIMATE_FLAG_LABELS[flag]}</Alert>
            </li>
          ))}
        </ul>
      )}
      {vs.notEstimated.length > 0 && (
        <p className="text-ink-secondary text-[0.8125rem]">
          {R.notEstimated(vs.notEstimated.length)}
        </p>
      )}
      <div className="border-border-default overflow-x-auto rounded border">
        <Measures vs={vs} />
      </div>
      <div className="border-border-default overflow-x-auto rounded border">
        {vs.vehiclesCompared ? (
          <Counts
            head={R.vehiclesByType}
            rows={vs.vehiclesByType.map((v) => ({ key: v.code, label: v.code, ...v }))}
          />
        ) : (
          <p className="text-ink-tertiary p-3 text-xs">{R.vehiclesNotCompared}</p>
        )}
      </div>
      <div className="border-border-default overflow-x-auto rounded border">
        <Counts
          head={R.cartons}
          rows={vs.cartonsByLine.map((line) => ({
            key: line.orderLineId,
            label: line.sku,
            estimated: line.estimated,
            actual: line.actual,
          }))}
        />
      </div>
    </div>
  );
}
