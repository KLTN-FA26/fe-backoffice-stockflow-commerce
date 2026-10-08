import type { StockItemRow } from "./types";

/** FEFO display order only; this does not allocate or decide sellability. */
export function orderStockItemsByExpiry(rows: StockItemRow[]): StockItemRow[] {
  return [...rows].sort((a, b) => {
    const aTime = a.expiry ? Date.parse(a.expiry) : Number.POSITIVE_INFINITY;
    const bTime = b.expiry ? Date.parse(b.expiry) : Number.POSITIVE_INFINITY;
    const left = Number.isNaN(aTime) ? Number.POSITIVE_INFINITY : aTime;
    const right = Number.isNaN(bTime) ? Number.POSITIVE_INFINITY : bTime;
    if (left === right) return 0;
    return left < right ? -1 : 1;
  });
}
