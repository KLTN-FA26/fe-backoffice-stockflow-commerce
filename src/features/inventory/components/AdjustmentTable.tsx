import Link from "next/link";

import { INVENTORY_LABELS, INVENTORY_ROUTES } from "@/constants/inventory";
import { STOCK_ADJUSTMENT_STATUS } from "@/constants/statuses";

import { formatDateTime } from "@/lib/format/date";

import { StatusDot } from "@/components/shared/StatusDot";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { adjustmentReasonLabel, formatSignedQuantity } from "../selectors";

import type { StockAdjustment } from "../types";

export function AdjustmentTable({ items }: { items: StockAdjustment[] }) {
  return (
    <div className="max-h-[calc(var(--card-pad)*32.5)] overflow-auto">
      <Table>
        <TableCaption className="sr-only">{INVENTORY_LABELS.adjustmentTitle}</TableCaption>
        <TableHeader className="bg-bg-subtle sticky top-0 z-[100]">
          <TableRow>
            {[
              INVENTORY_LABELS.adjustmentNumber,
              INVENTORY_LABELS.sku,
              INVENTORY_LABELS.location,
              INVENTORY_LABELS.requestedAt,
              INVENTORY_LABELS.quantityDelta,
              INVENTORY_LABELS.reason,
              INVENTORY_LABELS.status,
            ].map((label) => (
              <TableHead
                key={label}
                scope="col"
                className={label === INVENTORY_LABELS.quantityDelta ? "text-right" : undefined}
              >
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.adjustmentId}
              className={
                item.status === STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL
                  ? "border-l-warning border-l-2"
                  : undefined
              }
            >
              <TableCell>
                <Link
                  className="text-info focus-visible:ring-brand font-mono underline-offset-4 hover:underline focus-visible:ring-2"
                  href={INVENTORY_ROUTES.adjustment(item.adjustmentId)}
                >
                  {item.number}
                </Link>
              </TableCell>
              <TableCell className="font-mono">{item.sku}</TableCell>
              <TableCell className="font-mono">{item.locationCode}</TableCell>
              <TableCell>{formatDateTime(item.requestedAt)}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatSignedQuantity(item.quantityDelta)}
              </TableCell>
              <TableCell>{adjustmentReasonLabel(item.reason)}</TableCell>
              <TableCell>
                <StatusDot domain="stock" status={item.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
