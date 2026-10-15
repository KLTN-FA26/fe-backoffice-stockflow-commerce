import { INVENTORY_LABELS } from "@/constants/inventory";

import { formatDateTime } from "@/lib/format/date";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { movementTypeLabel } from "../selectors";

import type { StockMovement } from "../types";

export function MovementTable({ items }: { items: StockMovement[] }) {
  return (
    <div className="max-h-[calc(var(--card-pad)*32.5)] overflow-auto">
      <Table>
        <TableCaption className="sr-only">{INVENTORY_LABELS.movementTitle}</TableCaption>
        <TableHeader className="bg-bg-subtle sticky top-0 z-[100]">
          <TableRow>
            {[
              INVENTORY_LABELS.occurredAt,
              INVENTORY_LABELS.movementType,
              INVENTORY_LABELS.sku,
              INVENTORY_LABELS.lot,
              INVENTORY_LABELS.fromLocation,
              INVENTORY_LABELS.toLocation,
              INVENTORY_LABELS.quantity,
              INVENTORY_LABELS.reference,
              INVENTORY_LABELS.reason,
            ].map((label) => (
              <TableHead
                key={label}
                scope="col"
                className={label === INVENTORY_LABELS.quantity ? "text-right" : undefined}
              >
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.movementId}>
              <TableCell>{formatDateTime(item.occurredAt)}</TableCell>
              <TableCell>{movementTypeLabel(item.type)}</TableCell>
              <TableCell className="font-mono">{item.sku}</TableCell>
              <TableCell className="font-mono">
                {item.lotNumber ?? INVENTORY_LABELS.missing}
              </TableCell>
              <TableCell className="font-mono">
                {item.fromLocation ?? INVENTORY_LABELS.missing}
              </TableCell>
              <TableCell className="font-mono">
                {item.toLocation ?? INVENTORY_LABELS.missing}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">{item.quantity}</TableCell>
              <TableCell className="font-mono">{item.referenceType}</TableCell>
              <TableCell>{item.reason ?? INVENTORY_LABELS.missing}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
