/**
 * Purchase Order — selectors (pure derivations).
 *
 * Source: BE PurchaseOrder aggregate (open quantity semantics),
 * plus list-stats derived from BE 7-state.
 */

import { PO_STATUS } from "@/constants";
import { formatCompact, formatMoney } from "@/lib/format";

import type { PurchaseOrder, PoLine, PoStatus } from "./types";

export { formatMoney };
export { formatCompact as formatCompactVND };

export function openQuantity(line: PoLine): number {
  return Math.max(0, line.orderedQty - line.receivedQty);
}

export function isLineFullyReceived(line: PoLine): boolean {
  return line.receivedQty >= line.orderedQty;
}

export function totalOpenQuantity(po: PurchaseOrder): number {
  return po.lines.reduce((sum, line) => sum + openQuantity(line), 0);
}

export function totalOrderedQuantity(po: PurchaseOrder): number {
  return po.lines.reduce((sum, line) => sum + line.orderedQty, 0);
}

export function totalReceivedQuantity(po: PurchaseOrder): number {
  return po.lines.reduce((sum, line) => sum + line.receivedQty, 0);
}

export function receivedPercent(po: PurchaseOrder): number {
  const totalOrdered = po.lines.reduce((sum, line) => sum + line.orderedQty, 0);
  if (totalOrdered === 0) return 0;
  const totalReceived = po.lines.reduce((sum, line) => sum + line.receivedQty, 0);
  return Math.round((totalReceived / totalOrdered) * 100);
}

/* ── List-level stats ────────────────────────────────────────────────── */

export interface PoListStats {
  total: number;
  draft: number;
  approved: number;
  sent: number;
  partiallyReceived: number;
  closed: number;
  closedShort: number;
  cancelled: number;
  totalValueVND: number;
}

export function computePoStats(list: readonly PurchaseOrder[]): PoListStats {
  const result: PoListStats = {
    total: list.length,
    draft: 0,
    approved: 0,
    sent: 0,
    partiallyReceived: 0,
    closed: 0,
    closedShort: 0,
    cancelled: 0,
    totalValueVND: 0,
  };

  for (const po of list) {
    switch (po.status) {
      case PO_STATUS.DRAFT:
        result.draft++;
        break;
      case PO_STATUS.APPROVED:
        result.approved++;
        break;
      case PO_STATUS.SENT:
        result.sent++;
        break;
      case PO_STATUS.PARTIALLY_RECEIVED:
        result.partiallyReceived++;
        break;
      case PO_STATUS.CLOSED:
        result.closed++;
        break;
      case PO_STATUS.CLOSED_SHORT:
        result.closedShort++;
        break;
      case PO_STATUS.CANCELLED:
        result.cancelled++;
        break;
    }
    if (po.currency === "VND") result.totalValueVND += po.grandTotal;
  }
  return result;
}

/** Statuses that should flag a row in the list table. */
const FLAGGED_STATUSES: readonly PoStatus[] = [PO_STATUS.CANCELLED];

export function shouldFlagPoRow(po: PurchaseOrder): boolean {
  return FLAGGED_STATUSES.includes(po.status);
}
