import {
  INVENTORY_LABELS,
  STOCK_ADJUSTMENT_DIRECTION,
  STOCK_ADJUSTMENT_REASON_LABELS,
  STOCK_ADJUSTMENT_REASONS,
  STOCK_MOVEMENT_LABELS,
  STOCK_MOVEMENT_TYPES,
} from "@/constants/inventory";

import type { WarehouseOption } from "@/lib/references/warehouse-options";

// Known backend movement types are localized; a newer code is shown verbatim.
export function movementTypeLabel(type: string): string {
  const known = STOCK_MOVEMENT_TYPES.find((value) => value === type);
  return known ? STOCK_MOVEMENT_LABELS[known] : type;
}

// Ledger stock status codes are shown verbatim: `AVAILABLE → EXPIRED` when the row changes
// status (e.g. BE expiry sweep STATUS_CHANGE), the one known side otherwise.
export function movementStatusLabel(status?: string | null, toStatus?: string | null): string {
  if (status && toStatus && status !== toStatus) {
    return `${status} ${INVENTORY_LABELS.statusTransition} ${toStatus}`;
  }
  return status || toStatus || INVENTORY_LABELS.missing;
}

// Known adjustment reasons are localized; a newer backend code is shown verbatim.
export function adjustmentReasonLabel(reason: string): string {
  const known = STOCK_ADJUSTMENT_REASONS.find((value) => value === reason);
  return known ? STOCK_ADJUSTMENT_REASON_LABELS[known] : reason;
}

// Docs 20 BR-14 + ADR-0011 (BE, issue #305): an adjustment is one whole carton, written off or restocked, so
// its delta reads "−1 thùng (−120 cái)" — the units are the carton's `nominalQty`, left out when absent. A
// direction this screen does not know is shown verbatim.
export function formatAdjustmentDelta(adjustment: {
  direction: string;
  nominalQty?: number | null;
}): string {
  const sign =
    adjustment.direction === STOCK_ADJUSTMENT_DIRECTION.WRITE_OFF
      ? "−"
      : adjustment.direction === STOCK_ADJUSTMENT_DIRECTION.RESTOCK
        ? "+"
        : null;
  return sign
    ? INVENTORY_LABELS.cartonWholeDelta(sign, adjustment.nominalQty ?? null)
    : adjustment.direction;
}

// Use backend page metadata, never totals calculated from the current page.
export function inventoryPageRange(page: {
  items: readonly unknown[];
  page: number;
  size: number;
  totalElements: number;
}) {
  if (!page.items.length) return { first: 0, last: 0, total: page.totalElements };
  const first = page.page * page.size + 1;
  return {
    first,
    last: Math.min(first + page.items.length - 1, page.totalElements),
    total: page.totalElements,
  };
}

/**
 * The directory entry of a stock-level warehouse code (the backend location prefix). No match is
 * `null`: the caller must not fall back to another warehouse or derive an id from the code.
 */
export function selectWarehouseByCode(
  directory: readonly WarehouseOption[],
  code: string,
): WarehouseOption | null {
  const wanted = code.trim().toUpperCase();
  return directory.find((warehouse) => warehouse.code.trim().toUpperCase() === wanted) ?? null;
}
