import { INVENTORY_LABELS } from "@/constants/inventory";

import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { StockReservation } from "../types";

const { missing } = INVENTORY_LABELS;
const time = (value?: string | null) => (value ? formatDateTime(value) : missing);

/** Backend reservation rows as sent: the order's id (no order number exists), dashes for omitted fields. */
export function ReservationsTable({ items }: { items: readonly StockReservation[] }) {
  return (
    <Table>
      <TableCaption className="sr-only">{INVENTORY_LABELS.reservationsTitle}</TableCaption>
      <TableHeader className="bg-bg-subtle">
        <TableRow>
          {[
            INVENTORY_LABELS.order,
            INVENTORY_LABELS.location,
            INVENTORY_LABELS.lot,
            INVENTORY_LABELS.quantity,
            INVENTORY_LABELS.status,
            INVENTORY_LABELS.reservedAt,
            INVENTORY_LABELS.holdExpiresAt,
            INVENTORY_LABELS.releaseReason,
            INVENTORY_LABELS.closedAt,
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
        {items.map((hold) => (
          <TableRow key={hold.reservationId}>
            <TableCell className="font-mono text-xs">{hold.orderId}</TableCell>
            <TableCell className="font-mono">{hold.locationCode}</TableCell>
            <TableCell className="font-mono">{hold.lotNumber ?? missing}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatNumber(hold.quantity)}
            </TableCell>
            <TableCell className="font-mono text-xs">{hold.status}</TableCell>
            <TableCell className="tabular-nums">{time(hold.reservedAt)}</TableCell>
            <TableCell className="tabular-nums">{time(hold.expiresAt)}</TableCell>
            <TableCell className="font-mono text-xs">{hold.releaseReason ?? missing}</TableCell>
            <TableCell className="tabular-nums">{time(hold.closedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
