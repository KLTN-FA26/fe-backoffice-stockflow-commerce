import { UI_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format";
import { ToneDot } from "@/components/shared/column-helpers";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { Reconciliation } from "@/features/load-planning/plan-types";

const R = UI_LABELS.loadPlan.detail.reconciliation;

type Row = Reconciliation["pieceCheck"];

/**
 * Đối chiếu số kiện (sổ kép của `nesting-reconcile`): kiện trong kế hoạch = đã xếp + chưa xếp, cho cả kế hoạch, từng
 * lô giao và từng đơn. Dòng lệch tô cảnh báo; kiện bị để lại khi chốt và kiện ngoài kế hoạch hiện riêng cột.
 */
export function PieceCheckTable({ data }: { data: Reconciliation }) {
  const groups: [string, readonly Row[]][] = [
    [R.scopePlan, [data.pieceCheck]],
    [R.scopeShipment, data.shipments],
    [R.scopeOrder, data.orders],
  ];
  return (
    <div className="border-border-default overflow-x-auto rounded border">
      <Table>
        <TableCaption className="sr-only">{R.pieceCheck}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{R.pieceCheck}</TableHead>
            <TableHead className="text-right">{R.packagesIn}</TableHead>
            <TableHead className="text-right">{R.placed}</TableHead>
            <TableHead className="text-right">{R.unplaced}</TableHead>
            <TableHead className="text-right">{R.leftBehind}</TableHead>
            <TableHead className="text-right">{R.notInPlan}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.flatMap(([scope, rows]) =>
            rows.map((row) => (
              <TableRow key={`${scope}-${row.key}`}>
                <TableCell className="text-[0.8125rem]">
                  <span className="text-ink-tertiary mr-2 text-xs">{scope}</span>
                  <span className="font-mono">{row.code}</span>
                </TableCell>
                {[row.packagesIn, row.placed, row.unplaced, row.leftBehind, row.notInPlan].map(
                  (value, index) => (
                    <TableCell key={index} className="text-right tabular-nums">
                      {formatNumber(value)}
                    </TableCell>
                  ),
                )}
                <TableCell>
                  <ToneDot
                    tone={row.balanced ? "positive" : "danger"}
                    label={row.balanced ? R.balanced : R.unbalanced}
                  />
                </TableCell>
              </TableRow>
            )),
          )}
        </TableBody>
      </Table>
    </div>
  );
}
