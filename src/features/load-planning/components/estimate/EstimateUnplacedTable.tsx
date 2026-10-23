import { LOAD_ESTIMATE_LABELS, LOAD_PLANNING_LABELS } from "@/constants";
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
import { unplacedReasonText } from "../../lib/estimate-view";

import type { EstimateUnplaced } from "../../estimate-types";

/** Kiện chưa xếp được, nhóm theo dòng / phần / cỡ / lý do (BE `unplaced[]`), lý do bằng tiếng Việt. */
export function EstimateUnplacedTable({ unplaced }: { unplaced: readonly EstimateUnplaced[] }) {
  const L = LOAD_ESTIMATE_LABELS.unplaced;
  if (unplaced.length === 0) return null;
  return (
    <div className="border-danger/40 rounded border">
      <div className="border-danger/40 bg-bg-subtle text-danger border-b px-3 py-2 text-sm font-medium">
        {L.title}
      </div>
      <Table>
        <TableCaption className="sr-only">{L.title}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{L.item}</TableHead>
            <TableHead className="text-right">{L.dims}</TableHead>
            <TableHead className="text-right">{L.quantity}</TableHead>
            <TableHead>{L.reason}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {unplaced.map((line, index) => (
            <TableRow
              key={`${line.sourceRef ?? line.label}-${line.partName}-${line.reason}-${index}`}
            >
              <TableCell>
                <span className="font-medium">{line.partName || LOAD_PLANNING_LABELS.unnamed}</span>
                {line.label && <span className="text-ink-tertiary ml-2 text-xs">{line.label}</span>}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap tabular-nums">
                {formatNominalCm(line.origMm)}
              </TableCell>
              <TableCell className="text-danger text-right font-medium tabular-nums">
                {formatNumber(line.quantity)}
              </TableCell>
              <TableCell className="text-ink-secondary text-xs">
                {unplacedReasonText(line.reason)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
