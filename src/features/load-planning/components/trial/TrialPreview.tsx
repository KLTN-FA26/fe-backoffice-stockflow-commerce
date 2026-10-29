import { TRIAL_LABELS, TRIAL_MAX_BOXES } from "@/constants";
import { formatNumber } from "@/lib/format";
import { Alert } from "@/components/shared/Alert";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { TrialParseResult } from "../../trial/trial-parse";

const L = TRIAL_LABELS.preview;
const W = TRIAL_LABELS.warnings;

/**
 * Bước 2: danh sách kiện đọc từ file (đúng thứ tự file) và cảnh báo các dòng bị bỏ (Pieces 0 / kích thước ≤ 0, như
 * `warnings` của parsers.py). Quá giới hạn kiện của một lần ước tính thì báo ngay, nút chạy thử bị khoá.
 */
export function TrialPreview({ parsed, overCap }: { parsed: TrialParseResult; overCap: boolean }) {
  const { summary, skipped, lines } = parsed;
  return (
    <div className="space-y-3">
      <h2 className="text-ink-primary text-sm font-semibold">{L.title}</h2>
      <p className="text-ink-secondary text-[0.8125rem]">
        {L.summary(summary.rows, summary.totalPieces, summary.groups, summary.unitLabel)}
      </p>
      {skipped.length > 0 && (
        <Alert tone="warning" title={W.title(skipped.length)}>
          <ul className="mt-1 list-disc pl-5">
            {skipped.map((row) => (
              <li key={row.row}>
                {row.reason === "PIECES_MISSING"
                  ? W.piecesMissing(row.row)
                  : W.nonPositive(row.row)}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      {overCap && <Alert tone="danger">{L.overCap(summary.totalPieces, TRIAL_MAX_BOXES)}</Alert>}
      <div className="border-border-default max-h-80 overflow-auto rounded border">
        <Table>
          <TableCaption className="sr-only">{L.caption}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{L.name}</TableHead>
              <TableHead>{L.group}</TableHead>
              <TableHead className="text-right">{L.quantity}</TableHead>
              <TableHead className="text-right">{L.length}</TableHead>
              <TableHead className="text-right">{L.width}</TableHead>
              <TableHead className="text-right">{L.height}</TableHead>
              <TableHead>{L.rotatable}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.sourceRow}>
                <TableCell className="font-medium">{line.name}</TableCell>
                <TableCell className="text-ink-secondary">{line.group || L.noGroup}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(line.quantity)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(line.lengthMm)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(line.widthMm)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(line.heightMm)}
                </TableCell>
                <TableCell>{line.rotatable ? L.yes : L.no}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
