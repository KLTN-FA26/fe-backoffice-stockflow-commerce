import { INVENTORY_LABELS } from "@/constants/inventory";

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

import { CartonFigure } from "./CartonFigure";

import type { StockLevel } from "../types";

// Every quantity is the backend's own figure (StockLevelResponse); none is derived from another.
// ADR-0011 (BE, issue #305): cartons first, the units under them.
const QUANTITIES = [
  ["onHand", "onHandCartons", INVENTORY_LABELS.onHand],
  ["available", "availableCartons", INVENTORY_LABELS.available],
  ["reserved", "reservedCartons", INVENTORY_LABELS.reserved],
  ["allocated", "allocatedCartons", INVENTORY_LABELS.allocated],
  ["atp", "atpCartons", INVENTORY_LABELS.atp],
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
          {QUANTITIES.map(([key, , label]) => (
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
              {QUANTITIES.map(([key, cartonKey]) => (
                <TableCell key={key} className="text-right font-mono tabular-nums">
                  <CartonFigure cartons={level[cartonKey]} units={level[key]} />
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
