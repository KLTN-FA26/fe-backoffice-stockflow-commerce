import { MOVE_LABELS } from "@/constants/move";

import { HiddenDuringCountBadge } from "@/components/shared/HiddenDuringCountBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { isCountHidden, movableQuantity } from "../selectors";

import type { StockRow } from "../types";

/** Tồn hiện có của SKU theo vị trí — bấm một dòng để điền vị trí nguồn + lô. */
export function StockRowPicker({
  rows,
  selectedId,
  onPick,
}: {
  rows: readonly StockRow[];
  selectedId: string | undefined;
  onPick: (row: StockRow) => void;
}) {
  return (
    <div className="border-border-default overflow-auto rounded-[var(--r-sm)] border">
      <Table>
        <TableCaption className="sr-only">{MOVE_LABELS.stockTitle}</TableCaption>
        <TableHeader className="bg-bg-subtle">
          <TableRow>
            <TableHead scope="col">{MOVE_LABELS.stockLocation}</TableHead>
            <TableHead scope="col">{MOVE_LABELS.stockLot}</TableHead>
            <TableHead scope="col">{MOVE_LABELS.stockStatus}</TableHead>
            <TableHead scope="col" className="text-right">
              {MOVE_LABELS.stockOnHand}
            </TableHead>
            <TableHead scope="col" className="text-right">
              {MOVE_LABELS.stockReserved}
            </TableHead>
            <TableHead scope="col" className="text-right">
              {MOVE_LABELS.stockMovable}
            </TableHead>
            <TableHead scope="col" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const movable = movableQuantity(row);
            const hidden = isCountHidden(row);
            const picked = row.id === selectedId;
            return (
              <TableRow key={row.id} data-state={picked ? "selected" : undefined}>
                <TableCell className="font-mono">{row.locationCode}</TableCell>
                <TableCell className="font-mono">{row.lotNumber ?? MOVE_LABELS.missing}</TableCell>
                <TableCell className="font-mono">{row.status}</TableCell>
                {hidden ? (
                  <TableCell colSpan={3} className="text-right">
                    <HiddenDuringCountBadge />
                  </TableCell>
                ) : (
                  <>
                    <TableCell className="text-right font-mono tabular-nums">
                      {row.onHand}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {row.reserved}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{movable}</TableCell>
                  </>
                )}
                <TableCell className="text-right">
                  <Button
                    className="rounded-[var(--r-sm)]"
                    type="button"
                    size="sm"
                    variant={picked ? "default" : "outline"}
                    disabled={hidden || movable === 0}
                    aria-pressed={picked}
                    // A bin under count cannot be a source: say why instead of a mute disabled button.
                    title={hidden ? MOVE_LABELS.stockHiddenSource : undefined}
                    onClick={() => onPick(row)}
                  >
                    {picked ? MOVE_LABELS.stockPicked : MOVE_LABELS.stockPick}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
