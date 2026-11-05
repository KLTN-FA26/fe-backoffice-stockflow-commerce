import { INVENTORY_LABELS } from "@/constants/inventory";

import { formatNumber } from "@/lib/format/number";

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

import type { StockLevel } from "../types";

// Every quantity is the backend's own figure (StockLevelResponse); none is derived from another.
const QUANTITIES = [
  ["onHand", INVENTORY_LABELS.onHand],
  ["available", INVENTORY_LABELS.available],
  ["reserved", INVENTORY_LABELS.reserved],
  ["allocated", INVENTORY_LABELS.allocated],
  ["atp", INVENTORY_LABELS.atp],
] as const;

export function StockLevelsTable({
  levels,
  selectedCode,
  onSelect,
}: {
  levels: readonly StockLevel[];
  selectedCode: string | null;
  onSelect: (warehouseCode: string) => void;
}) {
  return (
    <Table>
      <TableCaption className="sr-only">{INVENTORY_LABELS.stockLevelsTitle}</TableCaption>
      <TableHeader className="bg-bg-subtle">
        <TableRow>
          <TableHead scope="col">{INVENTORY_LABELS.warehouse}</TableHead>
          {QUANTITIES.map(([key, label]) => (
            <TableHead key={key} scope="col" className="text-right">
              {label}
            </TableHead>
          ))}
          <TableHead scope="col">
            <span className="sr-only">{INVENTORY_LABELS.viewWarehouse}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {levels.map((level) => {
          const selected = level.warehouseCode === selectedCode;
          return (
            <TableRow key={level.warehouseCode} data-state={selected ? "selected" : undefined}>
              <TableCell className="font-mono">{level.warehouseCode}</TableCell>
              {QUANTITIES.map(([key]) => (
                <TableCell key={key} className="text-right font-mono tabular-nums">
                  {formatNumber(level[key])}
                </TableCell>
              ))}
              <TableCell className="text-right">
                <Button
                  className="rounded-[var(--r-sm)]"
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  aria-pressed={selected}
                  aria-label={`${INVENTORY_LABELS.viewWarehouse} ${level.warehouseCode}`}
                  onClick={() => onSelect(level.warehouseCode)}
                >
                  {selected ? INVENTORY_LABELS.viewingWarehouse : INVENTORY_LABELS.viewWarehouse}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
